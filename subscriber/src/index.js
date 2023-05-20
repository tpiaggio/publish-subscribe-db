const redis = require("redis");
const mongoose = require('mongoose');
mongoose.connect('mongodb://localhost:27017/mini-proyecto-2');
const User = require('./models/user');

const subscriber = redis.createClient();
const keywords = ['nodejs', 'mongodb'];

const listener = (message, channel) => {
  const post = JSON.parse(message);
  if (post.action == "DELETE" || keywords.some((keyword) => post.content.includes(keyword))) {
    console.log(`${post.action} post from ${post.author}: ${post.content}`);
  } else {
    console.log(`Post from ${post.author} has been filtered`);
  }
};

(async () => {
  const args = process.argv;
  await subscriber.connect();

  const user = await User.findOne({ username: args[2] }).populate('following');
  user.following.forEach(async (followingUser) => {
    await subscriber.subscribe(followingUser._id.toString(), listener);
  });
})();