const chai = require('chai');
const chaiHttp = require('chai-http');
const { expect } = chai;

chai.use(chaiHttp);

const URL = 'http://localhost:3000';

// HTTP POST request to add transactions for a specific payer and date.
describe('POST /api/transaction', () => {
  const transactions = [
    { payer: 'DANNON', points: 1000, timestamp: '2020-11-02T14:00:00Z' },
    { payer: 'UNILEVER', points: 200, timestamp: '2020-10-31T11:00:00Z' },
    { payer: 'DANNON', points: -200, timestamp: '2020-10-31T15:00:00Z' },
    { payer: 'MILLER COORS', points: 10000, timestamp: '2020-11-01T14:00:00Z' },
    { payer: 'DANNON', points: 300, timestamp: '2020-10-31T10:00:00Z' },
  ];

  const sortedTransactions = [
    {
      payer: 'DANNON',
      points: 100,
      timestamp: 1604138400000,
    },
    {
      payer: 'UNILEVER',
      points: 200,
      timestamp: 1604142000000,
    },
    {
      payer: 'MILLER COORS',
      points: 10000,
      timestamp: 1604239200000,
    },
    {
      payer: 'DANNON',
      points: 1000,
      timestamp: 1604325600000,
    },
  ];

  it('should sort all transactions by timestamp, add/settle each transaction for a specific payer and date, and return all valid transactions.', (done) => {
    chai
      .request(URL)
      .post('/api/transaction')
      .send(transactions)
      .end((err, res) => {
        if (err) done(err);
        expect(res).to.have.status(200);
        expect(res.body).to.be.an('array');
        expect(res.body).to.have.lengthOf.above(0);
        expect(res.body).to.deep.equal(sortedTransactions);
        done();
      });
  });

  it('should NOT add a transaction if the points is equal to 0.', (done) => {
    const newTransaction = [
      {
        payer: 'UNILEVER',
        points: 0,
        timestamp: '2020-10-31T11:00:00Z',
      },
    ];
    chai
      .request(URL)
      .post('/api/transaction')
      .send(newTransaction)
      .end((err, res) => {
        if (err) done(err);
        expect(res).to.have.status(422);
        done();
      });
  });

  it("should NOT add a transaction if the after addition the payer's points becomes negative.", (done) => {
    const newTransaction = [
      {
        payer: 'UNILEVER',
        points: -1000,
        timestamp: '2020-10-31T11:00:00Z',
      },
    ];
    chai
      .request(URL)
      .post('/api/transaction')
      .send(newTransaction)
      .end((err, res) => {
        if (err) done(err);
        expect(res).to.have.status(422);
        done();
      });
  });
});

// HTTP POST request to spend points using the rules above and return a list of { "payer": <string>, "points": <integer> } for each call.
describe('POST /api/spend', () => {
  it('should spend points and return a list of objects containing payer and spent points.', (done) => {
    const spend = {
      points: 5000,
    };
    const response = [
      {
        payer: 'DANNON',
        points: -100,
      },
      {
        payer: 'UNILEVER',
        points: -200,
      },
      {
        payer: 'MILLER COORS',
        points: -4700,
      },
    ];
    chai
      .request(URL)
      .post('/api/spend')
      .send(spend)
      .end((err, res) => {
        if (err) done(err);
        expect(res).to.have.status(200);
        expect(res.body).to.be.an('array');
        expect(res.body).to.have.lengthOf.above(0);
        expect(res.body).to.deep.equal(response);
        done();
      });
  });

  it('should NOT spend if points is less than or equal to zero', (done) => {
    const spend = {
      points: -100,
    };
    chai
      .request(URL)
      .post('/api/spend')
      .send(spend)
      .end((err, res) => {
        if (err) done(err);
        expect(res).to.have.status(422);
        done();
      });
  });

  it('should NOT spend if points is more than total available points.', (done) => {
    const spend = {
      points: 50000,
    };
    chai
      .request(URL)
      .post('/api/spend')
      .send(spend)
      .end((err, res) => {
        if (err) done(err);
        expect(res).to.have.status(422);
        done();
      });
  });
});

// HTTP GET request to return all payer point balances.
describe('GET /api/balances', () => {
  it('should return all payer point balances.', (done) => {
    const points = {
      DANNON: 1000,
      UNILEVER: 0,
      'MILLER COORS': 5300,
    };
    chai
      .request(URL)
      .get('/api/balances')
      .end((err, res) => {
        if (err) done(err);
        expect(res).to.have.status(200);
        expect(res).to.be.an('object');
        expect(res.body).to.deep.equals(points);
        expect(res.body).to.be.an('object');
        done();
      });
  });
});
