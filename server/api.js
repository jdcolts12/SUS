import { Router } from 'express';
import * as db from './db.js';

const router = Router();

// Create account (unique username, only used once ever)
router.post('/users', (req, res) => {
  try {
    const { username } = req.body;
    if (!username || typeof username !== 'string' || username.trim().length < 2) {
      return res.status(400).json({ error: 'Username must be at least 2 characters' });
    }
    const result = db.createUser(username);
    if (result.error) return res.status(400).json({ error: result.error });
    res.json(result);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Get user profile
router.get('/users/:id', (req, res) => {
  const user = db.getUser(req.params.id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const stats = db.getUserStats(req.params.id);
  res.json({ ...user, stats });
});

// Update profile (username, profile_pic, bg_color)
router.patch('/users/:id', (req, res) => {
  try {
    const { username, profile_pic, bg_color } = req.body;
    const updates = {};
    if (username !== undefined) updates.username = username;
    if (profile_pic !== undefined) updates.profile_pic = profile_pic;
    if (bg_color !== undefined) updates.bg_color = bg_color;
    const result = db.updateUser(req.params.id, updates);
    if (result.error) return res.status(400).json({ error: result.error });
    const user = db.getUser(req.params.id);
    res.json(user);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Find user by username (for friend search)
router.get('/users/search/:username', (req, res) => {
  const user = db.findByUsername(req.params.username);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ id: user.id, username: user.username, profile_pic: user.profile_pic, bg_color: user.bg_color });
});

// Send friend request
router.post('/users/:id/friends/request', (req, res) => {
  const { toUsername } = req.body;
  if (!toUsername) return res.status(400).json({ error: 'toUsername required' });
  const result = db.sendFriendRequest(req.params.id, toUsername);
  if (result.error) return res.status(400).json({ error: result.error });
  res.json({ success: true });
});

// Accept friend request
router.post('/users/:id/friends/accept', (req, res) => {
  const { requestId } = req.body;
  if (!requestId) return res.status(400).json({ error: 'requestId required' });
  const result = db.acceptFriendRequest(requestId, req.params.id);
  if (result.error) return res.status(400).json({ error: result.error });
  res.json({ success: true });
});

// Get friend requests (incoming)
router.get('/users/:id/friends/requests', (req, res) => {
  const requests = db.getFriendRequests(req.params.id);
  res.json(requests);
});

// Get friends list
router.get('/users/:id/friends', (req, res) => {
  const friends = db.getFriends(req.params.id);
  res.json(friends);
});

// Get user stats
router.get('/users/:id/stats', (req, res) => {
  const stats = db.getUserStats(req.params.id);
  res.json(stats);
});

export default router;
