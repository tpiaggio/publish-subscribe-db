const express = require('express');
const redis = require('redis');
const mongoose = require('mongoose');
mongoose.connect('mongodb://localhost:27017/mini-proyecto-2');
const User = require('./models/user');
const Post = require('./models/post');

const app = express();
const port = 3000;
const publisher = redis.createClient();

// Middleware to parse JSON request bodies
app.use(express.json());

app.post('/users', async (req, res) => {
  try {
    const user = new User({...req.body});
    await user.save();
    res.status(201).send(user);
  } catch (e) {
    res.status(500).send(e);
  }
});

app.post('/posts', async (req, res) => {
  const { author, content } = req.body;
  try {
    const user = await User.findById(author);
    if (!user) {
      res.status(400).send('Author is invalid');
      return;
    }
    const post = new Post({ author, content });
    await post.save();
    await publisher.connect();
    const message = {
      action: "CREATE",
      ...post._doc
    };
    console.log(author, JSON.stringify(message));
    await publisher.publish(author, JSON.stringify(message));
    res.send(post);
  } catch (e) {
    res.status(500).send(e);
  } finally {
    await publisher.quit();
  }
});

app.get('/users/:id/posts', async (req, res) => {
  const { id } = req.params;
  try {
    const user = await User.findById(id);
    if (!user) {
      res.status(400).send('User not found');
      return;
    }
    const posts = await Post.find({ author: user._id });
    res.send(posts);
  } catch(e) {
    res.status(500).send(e);
  }
});

app.post('/users/:id/follow', async (req, res) => {
  const { id } = req.params;
  const { followId } = req.body;
  try {
    const user = await User.findById(id);
    if (!user) {
      res.status(400).send('User not found');
      return;
    }
    if (user.following.includes(followId)) {
      res.status(400).send(`User ${id} already following user ${followId}`);
      return;
    }
    user.following.push(followId);
    await user.save();
    res.send(user);
  } catch(e) {
    res.status(500).send(e);
  }
});

app.delete('/users/:id/follow', async (req, res) => {
  const { id } = req.params;
  const { followId } = req.body;
  try {
    const user = await User.findById(id);
    if (!user) {
      res.status(400).send('User not found');
      return;
    }
    const i = user.following.indexOf(followId);
    user.following.splice(i, 1)
    await user.save();
    res.send(user);
  } catch(e) {
    res.status(500).send(e);
  }
});

app.delete('/posts/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const post = await Post.findById(id);
    if (!post) {
      res.status(400).send('Post not found');
      return;
    }
    await publisher.connect();
    const message = {
      action: "DELETE",
      ...post._doc
    };
    await publisher.publish(post.author._id.toString(), JSON.stringify(message));
    await Post.findByIdAndDelete(id);
    res.send(post);
  } catch (e) {
    console.log(e);
    res.status(500).send(e);
  } finally {
    await publisher.quit();
  }
});

app.post('/posts/:id/like', async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;
  try {
    const post = await Post.findById(id);
    if (!post) {
      res.status(400).send('Post not found');
      return;
    }
    if (post.likes.includes(userId)) {
      res.status(400).send('User already liked the post');
      return;
    }
    post.likes.push(userId);
    post.dislikes = post.dislikes?.filter((id) => !id.equals(userId));
    await post.save();
    res.send(post);
  } catch(e) {
    res.status(500).send(e);
  }
});

app.delete('/posts/:id/like', async (req, res) => {
  const { id } = req.params;
  const { userId } = req.body;
  try {
    const post = await Post.findById(id);
    if (!post) {
      res.status(400).send('Post not found');
      return;
    }
    if (post.dislikes.includes(userId)) {
      res.status(400).send('User already disliked the post');
      return;
    }
    post.dislikes.push(userId);
    post.likes = post.likes?.filter((id) => !id.equals(userId));
    await post.save();
    res.send(post);
  } catch(e) {
    res.status(500).send(e);
  }
});

// Start the server
app.listen(port, () => {
  console.log(`Server listening on port ${port}`);
});