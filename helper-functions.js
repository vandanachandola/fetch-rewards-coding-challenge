const Spend = require('./models/spend');

// find index to insert a transaction using Binary Search
const findIndex = (txArray, newTx) => {
  let startPtr = 0;
  let endPtr = txArray.length;
  while (startPtr < endPtr) {
    let midPtr = parseInt(startPtr + (endPtr - startPtr) / 2);
    if (txArray[midPtr].timestamp < newTx.timestamp) {
      startPtr = midPtr + 1;
    } else {
      endPtr = midPtr;
    }
  }
  return startPtr;
};

// find correct index to insert a transaction using Binary Search, and insert
// at that index to always maintain a sorted transactions array by timestamp.
const insertAtPosInTxArray = (txArray, newTx) => {
  const position = findIndex(txArray, newTx);
  txArray.splice(position, 0, newTx);
  return txArray;
};

// update spendDetails whenever a new spend action is performed to record which payer spent how much.
const updateSpendDetails = (spendDetails, currPayer, pointsSpentFromCurrTx) => {
  const newSpendDetail = new Spend(currPayer, -1 * pointsSpentFromCurrTx);
  spendDetails.push(newSpendDetail);
  return spendDetails;
};

// update payerBalanceMap whenever corresponding points for a pyer changes.
const updatePayerBalanceMap = (
  payerBalanceMap,
  currPayer,
  currPointsToUpdate
) => {
  const initialBalance = payerBalanceMap.has(currPayer)
    ? payerBalanceMap.get(currPayer)
    : 0;
  payerBalanceMap.set(currPayer, initialBalance + currPointsToUpdate);
  return payerBalanceMap;
};

// update totalAvailablePoints whenever a new transaction happens or points are spent.
const updateTotalAvailablePoints = (
  totalAvailablePoints,
  currPointsToUpdate
) => {
  totalAvailablePoints += currPointsToUpdate;
  return totalAvailablePoints;
};

module.exports = {
  findIndex,
  insertAtPosInTxArray,
  updateSpendDetails,
  updatePayerBalanceMap,
  updateTotalAvailablePoints,
};
