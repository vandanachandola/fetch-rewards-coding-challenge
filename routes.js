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

let totalAvailablePoints = 0;
let payerBalanceMap = new Map();
let allTransactions = [];

router.get('/balances', (req, res) => {
  res.send(Object.fromEntries(payerBalanceMap));
});

router.post(
  '/transaction',
  body('payer').trim().not().isEmpty(),
  body('points').isNumeric(),
  body('timestamp').isISO8601(),
  (req, res) => {
    // discard if points = 0.
    //  if negative, check if payer balance is greater or equal.
    // get timestamp from user
    // add validations to check empty or not
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(HttpCodes.BadRequest).json({ errors: errors.array() });
    }

    try {
      const { payer, points } = req.body;
      const timestamp = Date.parse(req.body.timestamp);
      const currPayerBalance = payerBalanceMap.has(payer)
        ? payerBalanceMap.get(payer)
        : 0;

      if (points === 0) {
        return res.status(HttpCodes.UnprocessableEntity).send({
          errorMsg: 'Points cannot be 0, it must be less than or more than 0.',
        });
      }
      if (
        (!payerBalanceMap.has(payer) && points < 0) ||
        payerBalanceMap.get(payer) + points < 0
      ) {
        return res.status(HttpCodes.UnprocessableEntity).send({
          errorMsg: `Points per payer cannot be negative. Payer ${payer}'s current point balance is ${currPayerBalance}`,
        });
      }

      if (points > 0) {
        const newTransaction = new Transaction(payer, points, timestamp);
        allTransactions = insertAtPosInTxArray(allTransactions, newTransaction);
      } else {
        let pointsToMinus = points;
        for (let currTx of allTransactions) {
          if (currTx.payer === payer) {
            if (currTx.points + pointsToMinus >= 0) {
              currTx.points += pointsToMinus;
              break;
            } else {
              pointsToMinus += currTx.points;
              currTx.points = 0;
            }
          }
        }
        allTransactions = allTransactions.filter((tx) => tx.points > 0);
      }

      payerBalanceMap.set(payer, currPayerBalance + points);
      totalAvailablePoints += points;

      res.status(HttpCodes.OK).send(allTransactions);
    } catch (error) {
      return res.status(HttpCodes.InternalServerError).send({
        error: error,
        errorMsg: 'Some error occured',
      });
    }
  }
);

router.post('/spend', body('points').isNumeric(), (req, res) => {
  // discard if points = 0 or negative.
  // if spend points > total available, discard.
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(HttpCodes.BadRequest).json({ errors: errors.array() });
  }

  try {
    const { points } = req.body;

    if (points <= 0) {
      return res
        .status(HttpCodes.UnprocessableEntity)
        .send({ errorMsg: 'Points to be spent must be more than 0.' });
    }
    if (points > totalAvailablePoints) {
      return res.status(HttpCodes.UnprocessableEntity).send({
        errorMsg:
          'Points to be spent cannot be more than the total available points.',
      });
    }

    let spendDetails = [];
    let pointsToMinus = points;

    for (let currTx of allTransactions) {
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

    allTransactions = allTransactions.filter((tx) => tx.points > 0);
    return res.status(HttpCodes.OK).send(spendDetails);
  } catch (error) {
    return res.status(HttpCodes.InternalServerError).send({
      error: error,
      errorMsg: 'Some error occured',
    });
  }
});

module.exports = router;
