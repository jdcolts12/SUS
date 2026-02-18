import { Router } from 'express';
import * as db from './db.js';

const router = Router();

// Create account (unique username + password)
router.post('/users', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || typeof username !== 'string' || username.trim().length < 2) {
      return res.status(400).json({ error: 'Username must be at least 2 characters' });
    }
    if (!password || typeof password !== 'string') {
      return res.status(400).json({ error: 'Password required' });
    }
    const result = await db.createUser(username, password);
    if (result.error) return res.status(400).json({ error: result.error });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Sign in (username + password)
router.post('/auth/sign-in', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password required' });
    }
    const result = await db.signIn(username, password);
    if (result.error) return res.status(400).json({ error: result.error });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get user profile (exclude password_hash)
router.get('/users/:id', async (req, res) => {
  try {
    const user = await db.getUser(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const stats = await db.getUserStats(req.params.id);
    const { password_hash, ...safe } = user;
    res.json({ ...safe, stats });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Update profile (username, profile_pic, bg_color)
router.patch('/users/:id', async (req, res) => {
  try {
    const { username, profile_pic, bg_color } = req.body;
    const updates = {};
    if (username !== undefined) updates.username = username;
    if (profile_pic !== undefined) updates.profile_pic = profile_pic;
    if (bg_color !== undefined) updates.bg_color = bg_color;
    const result = await db.updateUser(req.params.id, updates);
    if (result.error) return res.status(400).json({ error: result.error });
    const user = await db.getUser(req.params.id);
    res.json(user);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Find user by username (for friend search)
router.get('/users/search/:username', async (req, res) => {
  try {
    const user = await db.findByUsername(req.params.username);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ id: user.id, username: user.username, profile_pic: user.profile_pic, bg_color: user.bg_color });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Send friend request
router.post('/users/:id/friends/request', async (req, res) => {
  try {
    const { toUsername } = req.body;
    if (!toUsername) return res.status(400).json({ error: 'toUsername required' });
    const result = await db.sendFriendRequest(req.params.id, toUsername);
    if (result.error) return res.status(400).json({ error: result.error });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Accept friend request
router.post('/users/:id/friends/accept', async (req, res) => {
  try {
    const { requestId } = req.body;
    if (!requestId) return res.status(400).json({ error: 'requestId required' });
    const result = await db.acceptFriendRequest(requestId, req.params.id);
    if (result.error) return res.status(400).json({ error: result.error });
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get friend requests (incoming)
router.get('/users/:id/friends/requests', async (req, res) => {
  try {
    const requests = await db.getFriendRequests(req.params.id);
    res.json(requests);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get friends list
router.get('/users/:id/friends', (req, res) => {
  const friends = db.getFriends(req.params.id);
  res.json(friends);
});

// Get user stats
router.get('/users/:id/stats', async (req, res) => {
  try {
    const stats = await db.getUserStats(req.params.id);
    res.json(stats);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Leaderboard - all players with stats
router.get('/leaderboard', async (req, res) => {
  try {
    const leaderboard = await db.getLeaderboard();
    res.json(leaderboard);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
