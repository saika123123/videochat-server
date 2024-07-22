require('dotenv').config();
const express = require('express');
const { Sequelize, DataTypes } = require('sequelize');
const cors = require('cors');
const cron = require('node-cron');

const app = express();
app.use(cors());
app.use(express.json());

// Sequelize setup
const sequelize = new Sequelize(process.env.DB_NAME, process.env.DB_USER, process.env.DB_PASS, {
  host: process.env.DB_HOST,
  dialect: 'mysql'
});

// Define models
const Meeting = sequelize.define('Meeting', {
  id: {
    type: DataTypes.STRING,
    primaryKey: true
  },
  name: DataTypes.STRING,
  date: DataTypes.DATEONLY,
  time: DataTypes.TIME,
  participants: DataTypes.JSON,
  participantNames: DataTypes.JSON,
  url: DataTypes.STRING,
  creator: DataTypes.STRING
});

const Notification = sequelize.define('Notification', {
  id: {
    type: DataTypes.INTEGER,
    autoIncrement: true,
    primaryKey: true
  },
  userId: DataTypes.STRING,
  message: DataTypes.TEXT,
  read: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  }
});

// Sync models with database
sequelize.sync();

// API endpoints
app.post('/api/meetings', async (req, res) => {
  try {
    const meeting = await Meeting.create(req.body);
    res.status(201).json(meeting);
  } catch (error) {
    res.status(500).json({ error: 'Error creating meeting' });
  }
});

app.get('/api/meetings/:userId', async (req, res) => {
  try {
    const meetings = await Meeting.findAll({
      where: {
        participants: {
          [Sequelize.Op.like]: `%${req.params.userId}%`
        }
      }
    });
    res.json(meetings);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching meetings' });
  }
});

app.post('/api/notifications', async (req, res) => {
  try {
    const notifications = await Promise.all(
      req.body.participants.map(userId => 
        Notification.create({
          userId,
          message: `New meeting: ${req.body.meetingName}`
        })
      )
    );
    res.status(201).json(notifications);
  } catch (error) {
    res.status(500).json({ error: 'Error creating notifications' });
  }
});

app.get('/api/notifications/:userId', async (req, res) => {
  try {
    const notifications = await Notification.findAll({
      where: { userId: req.params.userId }
    });
    res.json(notifications);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching notifications' });
  }
});

// Auto-start meeting function
async function autoStartMeeting() {
  const now = new Date();
  const meetings = await Meeting.findAll();
  const meetingsToStart = meetings.filter(meeting => {
    const meetingDateTime = new Date(`${meeting.date}T${meeting.time}`);
    const timeDiff = meetingDateTime.getTime() - now.getTime();
    return timeDiff >= 0 && timeDiff <= 5 * 60 * 1000; // 5分以内に開始する会議
  });

  for (let meeting of meetingsToStart) {
    console.log(`Auto-starting meeting: ${meeting.name}`);
    
    // メイちゃん上で参加者に通知
    for (let participant of meeting.participants) {
      await Notification.create({
        userId: participant,
        message: `会議「${meeting.name}」が間もなく開始されます。時間: ${meeting.time}, URL: ${meeting.url}`
      });
    }
  }
}

// 1分ごとに自動開始機能を実行
cron.schedule('* * * * *', autoStartMeeting);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));