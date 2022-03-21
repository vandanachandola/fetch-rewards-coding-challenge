const express = require('express');
const { body, validationResult } = require('express-validator');

const Transaction = require('./models/transaction');
const HttpCodes = require('./models/http-codes');
const {
  insertAtPosInTxArray,
  updateSpendDetails,
  updatePayerBalanceMap,
  updateTotalAvailablePoints,
} = require('./helper-functions');

const router = express.Router();

// total available points for all payers combined for a user
let totalAvailablePoints = 0;
// payer and corresponding point balance representation for a user
let payerBalanceMap = new Map();
// array of all valid transactions sorted by timestamp for a user
let allValidTransactions = [];

// HTTP GET request to return all payer point balances.
router.get('/balances', (req, res) => {
  res.send(Object.fromEntries(payerBalanceMap));
});

// HTTP POST request to add transactions array for a specific payer and date.
router.post(
  '/transaction',
  body().isArray(),
  body('*.payer').trim().not().isEmpty(),
  body('*.points').isNumeric(),
  body('*.timestamp').isISO8601(),
  (req, res) => {
    // return Bad Request if sanity checks fail
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(HttpCodes.BadRequest).json({ errors: errors.array() });
    }

    try {
      const transactions = req.body;
      const invalidTransactions = [];

      // sort the array of transactions in s=ascending order of timestamp
      const sortedTransactionsByTimestamp = transactions.sort((tx1, tx2) => {
        return tx1.timestamp < tx2.timestamp
          ? -1
          : tx1.timestamp > tx2.timestamp
          ? 1
          : 0;
      });

      // For all incoming transactions, if points are +ve, add to allValidTransactions array.
      // Else if -ve, process it with the oldest tranasaction first of same payer.
      for (let sortedCurrTx of sortedTransactionsByTimestamp) {
        const { payer, points } = sortedCurrTx;
        const timestamp = Date.parse(sortedCurrTx.timestamp);

        // get current payer's existing balance if available
        const currPayerBalance = payerBalanceMap.has(payer)
          ? payerBalanceMap.get(payer)
          : 0;

        if (points > 0) {
          // Since points are +ve, add it as a new transaction in a sorted manner (using Binary Search) to allValidTransactions array.
          const newTransaction = new Transaction(payer, points, timestamp);
          allValidTransactions = insertAtPosInTxArray(
            allValidTransactions,
            newTransaction
          );
        } else {
          // If points are 0, or if the addition of points will make the current payer go negative, discard the transaction.
          if (
            (!payerBalanceMap.has(payer) && points < 0) ||
            payerBalanceMap.get(payer) + points < 0 ||
            points === 0
          ) {
            invalidTransactions.push(new Transaction(payer, points, timestamp));
            continue;
          } else {
            // At this point it is okay to adjust the -ve points with the oldest transaction of the same payer.
            let negativePointsToSubtract = points;
            for (let currTx of allValidTransactions) {
              if (currTx.payer === payer) {
                // If the current points are sufficient to settle the -ve points, settle it and break out of the loop.
                // Else keep on moving on to the next transaction to settle the -ve points.
                if (currTx.points + negativePointsToSubtract >= 0) {
                  currTx.points += negativePointsToSubtract;
                  negativePointsToSubtract = 0;
                  break;
                } else {
                  negativePointsToSubtract += currTx.points;
                  currTx.points = 0;
                }
              }
            }
            // remove all transactions that are expended (i.e., the points have become 0.)
            allValidTransactions = allValidTransactions.filter(
              (tx) => tx.points > 0
            );
          }
        }
        // Update the payerBalanceMap and totalAvailablePoints accordingly.
        payerBalanceMap = updatePayerBalanceMap(payerBalanceMap, payer, points);
        totalAvailablePoints = updateTotalAvailablePoints(
          totalAvailablePoints,
          points
        );
      }

      // if there are one or move invalid transactions return them, else send OK.
      if (invalidTransactions.length === 0) {
        res.status(HttpCodes.OK).send(allValidTransactions);
      } else {
        return res.status(HttpCodes.UnprocessableEntity).send({
          allValidTransactions,
          invalidTransactions,
          errorMsg:
            'Points cannot be 0 and points per payer cannot go negative.',
        });
      }
    } catch (error) {
      return res.status(HttpCodes.InternalServerError).send({
        error: error,
        errorMsg: 'Some error occured',
      });
    }
  }
);

// HTTP POST request to spend points using the rules above and return a list of { "payer": <string>, "points": <integer> } for each call.
router.post('/spend', body('points').isNumeric(), (req, res) => {
  // return Bad Request if sanity checks fail
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(HttpCodes.BadRequest).json({ errors: errors.array() });
  }

  try {
    const { points } = req.body;

    // return Unprocessable Entity if the user is trying to spend 0 or less than 0 points.
    if (points <= 0) {
      return res
        .status(HttpCodes.UnprocessableEntity)
        .send({ errorMsg: 'Points to be spent must be more than 0.' });
    }
    // return Unprocessable Entity if the user is trying to spend more than available points for a user.
    if (points > totalAvailablePoints) {
      return res.status(HttpCodes.UnprocessableEntity).send({
        errorMsg:
          'Points to be spent cannot be more than the total available points.',
      });
    }

    let spendDetails = [];
    let pointsToMinus = points;

    // Go through allValidTransactions which is in sorted order, and one-by-one try to settle the spend points with each transaction.
    // If partly settled, keep on going until the spend points are fully spent, after which break out the loop.
    for (let currTx of allValidTransactions) {
      let pointsSpentFromCurrTx = 0;
      let currPayer = currTx.payer;

      if (currTx.points >= pointsToMinus) {
        pointsSpentFromCurrTx = pointsToMinus;
        currTx.points -= pointsSpentFromCurrTx;
        pointsToMinus = 0;
      } else {
        pointsSpentFromCurrTx = currTx.points;
        pointsToMinus -= pointsSpentFromCurrTx;
        currTx.points = 0;
      }

      // Update current spend details, the payerBalanceMap and the totalAvailablePoints
      spendDetails = updateSpendDetails(
        spendDetails,
        currPayer,
        pointsSpentFromCurrTx
      );
      payerBalanceMap = updatePayerBalanceMap(
        payerBalanceMap,
        currPayer,
        -1 * pointsSpentFromCurrTx
      );
      totalAvailablePoints = updateTotalAvailablePoints(
        totalAvailablePoints,
        -1 * pointsSpentFromCurrTx
      );

      if (pointsToMinus === 0) {
        break;
      }
    }
    // remove all transactions that are expended (i.e., the points have become 0.)
    allValidTransactions = allValidTransactions.filter((tx) => tx.points > 0);
    return res.status(HttpCodes.OK).send(spendDetails);
  } catch (error) {
    return res.status(HttpCodes.InternalServerError).send({
      error: error,
      errorMsg: 'Some error occured',
    });
  }
});

module.exports = router;
