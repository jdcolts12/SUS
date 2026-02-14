import { useState, useRef, useEffect } from 'react';
import { api } from '../api';

const PRESET_COLORS = ['#1a1a2e', '#252542', '#e94560', '#4ecca3', '#ff6b35', '#6c5ce7', '#00b894', '#fdcb6e'];

function EditProfile({ userId, onSaved, onBack }) {
  const [username, setUsername] = useState('');
  const [bgColor, setBgColor] = useState('#1a1a2e');
  const [profilePic, setProfilePic] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (userId) {
      api.getUser(userId).then((u) => {
        setUsername(u.username || '');
        setBgColor(u.bg_color || '#1a1a2e');
        setProfilePic(u.profile_pic || '');
      }).catch(() => {});
    }
  }, [userId]);

  const handlePhotoChange = (e) => {
    const file = e.target.files?.[0];
    if (!file || !file.type.startsWith('image/')) return;
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const size = Math.min(img.width, img.height, 300);
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, size, size);
        setProfilePic(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username.trim()) return;
    setLoading(true);
    setError('');
    try {
      await api.updateUser(userId, { username: username.trim(), profile_pic: profilePic || null, bg_color: bgColor });
      onSaved?.(username.trim());
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="edit-profile">
      <h2>Edit Profile</h2>
      <form onSubmit={handleSubmit}>
        <div className="edit-profile__avatar" onClick={() => fileInputRef.current?.click()}>
          <input type="file" ref={fileInputRef} accept="image/*" onChange={handlePhotoChange} hidden />
          {profilePic ? (
            <img src={profilePic} alt="" />
          ) : (
            <span>Tap to add photo</span>
          )}
        </div>

        <label>Username (unique, used once)</label>
        <input
          type="text"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Username"
          maxLength={20}
          required
        />

        <label>Profile background</label>
        <div className="edit-profile__colors">
          {PRESET_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              className={`edit-profile__color ${bgColor === c ? 'active' : ''}`}
              style={{ backgroundColor: c }}
              onClick={() => setBgColor(c)}
            />
          ))}
        </div>
        <input
          type="color"
          value={bgColor}
          onChange={(e) => setBgColor(e.target.value)}
          className="edit-profile__color-picker"
        />

        {error && <p className="edit-profile__error">{error}</p>}
        <button type="submit" className="btn btn--primary" disabled={loading}>
          {loading ? 'Saving...' : 'Save'}
        </button>
      </form>
      <button className="btn btn--ghost" onClick={onBack}>Cancel</button>
    </div>
  );
}

export default EditProfile;
