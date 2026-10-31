const socket = io();
const config = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
const peers = {};
let localStream = null;
let muted = false;
let myName = '';

async function joinRoom() {
  myName = document.getElementById('name').value.trim();
  const room = document.getElementById('room').value.trim();
  if (!myName || !room) return alert('Enter your name and a room code');

  try {
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (e) {
    return alert('Microphone access is needed to join.');
  }

  document.getElementById('join-screen').classList.add('hidden');
  document.getElementById('room-screen').classList.remove('hidden');
  document.getElementById('room-title').textContent = 'Room: ' + room;
  addUser('me', myName + ' (you)');
  socket.emit('join', { room, name: myName });
}

socket.on('existing-users', (users) => {
  users.forEach((u) => {
    addUser(u.id, u.name);
    createPeer(u.id, true);
  });
});

socket.on('user-joined', (u) => {
  addUser(u.id, u.name);
  createPeer(u.id, false);
});

socket.on('user-left', ({ id }) => {
  if (peers[id]) { peers[id].close(); delete peers[id]; }
  const el = document.getElementById('user-' + id);
  if (el) el.remove();
  const audio = document.getElementById('audio-' + id);
  if (audio) audio.remove();
});

socket.on('signal', async ({ from, data }) => {
  if (!peers[from]) createPeer(from, false);
  const pc = peers[from];
  if (data.sdp) {
    await pc.setRemoteDescription(data.sdp);
    if (data.sdp.type === 'offer') {
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('signal', { to: from, data: { sdp: pc.localDescription } });
    }
  } else if (data.candidate) {
    try { await pc.addIceCandidate(data.candidate); } catch (e) {}
  }
});

function createPeer(id, initiator) {
  const pc = new RTCPeerConnection(config);
  peers[id] = pc;
  localStream.getTracks().forEach((t) => pc.addTrack(t, localStream));

  pc.onicecandidate = (e) => {
    if (e.candidate) socket.emit('signal', { to: id, data: { candidate: e.candidate } });
  };

  pc.ontrack = (e) => {
    let audio = document.getElementById('audio-' + id);
    if (!audio) {
      audio = document.createElement('audio');
      audio.id = 'audio-' + id;
      audio.autoplay = true;
      document.getElementById('audio-container').appendChild(audio);
    }
    audio.srcObject = e.streams[0];
  };

  if (initiator) {
    pc.onnegotiationneeded = async () => {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      socket.emit('signal', { to: id, data: { sdp: pc.localDescription } });
    };
  }
}

function addUser(id, name) {
  const li = document.createElement('li');
  li.id = 'user-' + id;
  li.textContent = name;
  document.getElementById('users').appendChild(li);
}

function toggleMute() {
  muted = !muted;
  localStream.getAudioTracks().forEach((t) => (t.enabled = !muted));
  document.getElementById('mute-btn').textContent = muted ? 'Unmute' : 'Mute';
}

function leaveRoom() {
  socket.emit('leave');
  Object.values(peers).forEach((pc) => pc.close());
  localStream.getTracks().forEach((t) => t.stop());
  location.reload();
}
