const Spend = require('./models/spend');

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

const insertAtPosInTxArray = (txArray, newTx) => {
  const position = findIndex(txArray, newTx);
  txArray.splice(position, 0, newTx);
  return txArray;
};

const updateSpendDetails = (spendDetails, currPayer, pointsSpentFromCurrTx) => {
  const newSpendDetail = new Spend(currPayer, -1 * pointsSpentFromCurrTx);
  spendDetails.push(newSpendDetail);
  return spendDetails;
};

const updatePayerBalanceMap = (
  payerBalanceMap,
  currPayer,
  currPointsToUpdate
) => {
  payerBalanceMap.set(
    currPayer,
    payerBalanceMap.get(currPayer) + currPointsToUpdate
  );
  return payerBalanceMap;
};

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
