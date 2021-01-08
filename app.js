const cors = require('cors');
const createError = require('http-errors');
const express = require('express');
const monk = require('monk');
const path = require('path');

const app = express();
const db = monk('localhost:27017/assignment1');

db.then(() => {
  console.log('Successfully connected to db');
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(express.static(path.join(__dirname, 'public')));
app.use((req, _, next) => {
  req.db = db;
  return next();
});

app.get('/retrieveemaillist', async (req, res) => {
  const {
    db,
    query: { mailbox, limit = 3, page = 1 },
  } = req;

  const collection = db.get('emailList');
  const emailLimit = parseInt(limit, 10);
  const emailPage = parseInt(page, 10);

  try {
    const emails = await collection.find(
      { mailbox },
      {
        limit: emailLimit,
        projection: {
          // For Sent mailbox, we need to show the recipient rather than the sender
          ...(mailbox === 'Sent' ? { recipient: 1 } : { sender: 1 }),
          time: 1,
          title: 1,
        },
        skip: (emailPage - 1) * emailLimit,
        sort: { time: -1 },
      }
    );
    return res.json(emails);
  } catch (err) {
    return res.status(500).send(err);
  }
});

app.get('/getemail', async (req, res) => {
  const {
    db,
    query: { head, id, tail },
  } = req;

  const collection = db.get('emailList');

  try {
    let email;
    if (id) {
      email = await collection.findOne({ _id: id }, { projection: { mailbox: 0 } });
    } else if (head) {
      email = await collection.findOne({ time: { $gt: head } }, { projection: { mailbox: 0 } });
    } else if (tail) {
      email = await collection.findOne({ time: { $lt: tail } }, { projection: { mailbox: 0 } });
    }
    return res.json(email);
  } catch (err) {
    return res.status(500).send(err);
  }
});

app.post('/changemailbox', async (req, res) => {
  const {
    body: { curMailbox, ids, newMailbox, tail },
    db,
  } = req;

  const collection = db.get('emailList');
  const idList = ids.split(',').sort();

  try {
    for (const id of idList) {
      await collection.findOneAndUpdate({ _id: id }, { $set: { mailbox: newMailbox } });
    }

    const olderEmails = await collection.find(
      { ...(tail && { time: { $lte: new Date(tail) } }), mailbox: curMailbox },
      {
        limit: idList.length,
        projection: {
          ...(curMailbox === 'Sent' ? { recipient: 1 } : { sender: 1 }),
          time: 1,
          title: 1,
        },
        sort: { _id: -1, time: -1 },
      }
    );

    return res.json(olderEmails);
  } catch (err) {
    return res.status(500).send(err);
  }
});

// catch 404 and forward to error handler
app.use((_, __, next) => next(createError(404)));

// error handler
app.use((err, req, res) => {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  return res.sendStatus(err.status || 500);
});

const server = app.listen(8081, () => {
  const host = server.address().address;
  const port = server.address().port;

  console.log('WebMail app listening at http://%s:%s', host, port);
});
