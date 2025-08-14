const startScreen = document.getElementById('startScreen');
    const createScreen = document.getElementById('createScreen');
    const joinScreen = document.getElementById('joinScreen');
    const chatScreen = document.getElementById('chatScreen');
    const statusBadge = document.getElementById('statusBadge');
    const chatDiv = document.getElementById('chat');
    const msgInput = document.getElementById('msg');

    let pc, dc;
    const config = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

    // Typing indicator
    let typingTimeout;
    let typingElem;
    let typingDotsInterval;

    function showTyping() {
        if (!typingElem) {
            typingElem = document.createElement('div');
            typingElem.className = 'typing';
            chatDiv.appendChild(typingElem);
        }
        let dots = '';
        let step = 0;
        clearInterval(typingDotsInterval);
        typingDotsInterval = setInterval(() => {
            dots = '.'.repeat((step % 3) + 1);
            typingElem.textContent = `typing${dots}`;
            step++;
        }, 300);
    }

    function hideTyping() {
        clearInterval(typingDotsInterval);
        if (typingElem) {
            chatDiv.removeChild(typingElem);
            typingElem = null;
        }
    }

    function showScreen(screen) {
        [startScreen, createScreen, joinScreen, chatScreen].forEach(s => s.classList.add('hidden'));
        screen.classList.remove('hidden');
    }

    function logMsg(msg, type) {
        hideTyping(); // remove typing indicator when message received
        const div = document.createElement('div');
        div.className = type;
        div.textContent = msg;
        chatDiv.appendChild(div);
        chatDiv.scrollTop = chatDiv.scrollHeight;
    }

    function updateStatus(online) {
        statusBadge.textContent = online ? "Online" : "Offline";
        statusBadge.classList.toggle('online', online);
    }

    document.getElementById('chooseCreate').onclick = () => showScreen(createScreen);
    document.getElementById('chooseJoin').onclick = () => showScreen(joinScreen);

    // Close buttons
    document.getElementById('closeCreate').onclick = () => showScreen(startScreen);
    document.getElementById('closeJoin').onclick = () => showScreen(startScreen);

    // Copy buttons
    document.querySelectorAll('.copy-btn').forEach(btn => {
        btn.onclick = () => {
            const targetId = btn.getAttribute('data-copy');
            const text = document.getElementById(targetId).value;

            navigator.clipboard.writeText(text).then(() => {
                btn.textContent = "Copied!";
                setTimeout(() => btn.textContent = "Copy " + (targetId.includes("offer") ? "Offer" : "Answer") + " Code", 1500);
            }).catch(() => {
                const temp = document.createElement("textarea");
                temp.value = text;
                document.body.appendChild(temp);
                temp.select();
                document.execCommand("copy");
                document.body.removeChild(temp);

                btn.textContent = "Copied!";
                setTimeout(() => btn.textContent = "Copy " + (targetId.includes("offer") ? "Offer" : "Answer") + " Code", 1500);
            });
        };
    });

    document.getElementById('createOfferBtn').onclick = async () => {
        pc = new RTCPeerConnection(config);
        dc = pc.createDataChannel('chat');
        dc.onmessage = e => {
            if (e.data === "__typing__") {
                showTyping();
                clearTimeout(typingTimeout);
                typingTimeout = setTimeout(hideTyping, 1500);
            } else {
                logMsg(e.data, 'other');
            }
        };
        dc.onopen = () => {
            updateStatus(true);
            showScreen(chatScreen);
        };
        dc.onclose = () => updateStatus(false);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        pc.onicecandidate = e => {
            if (!e.candidate) document.getElementById('offerOut').value = JSON.stringify(pc.localDescription);
        };
    };

    document.getElementById('createAnswerBtn').onclick = async () => {
        pc = new RTCPeerConnection(config);
        pc.ondatachannel = e => {
            dc = e.channel;
            dc.onmessage = ev => {
                if (ev.data === "__typing__") {
                    showTyping();
                    clearTimeout(typingTimeout);
                    typingTimeout = setTimeout(hideTyping, 1500);
                } else {
                    logMsg(ev.data, 'other');
                }
            };
            dc.onopen = () => {
                updateStatus(true);
                showScreen(chatScreen);
            };
            dc.onclose = () => updateStatus(false);
        };
        await pc.setRemoteDescription(JSON.parse(document.getElementById('offerIn').value));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        pc.onicecandidate = e => {
            if (!e.candidate) document.getElementById('answerOut').value = JSON.stringify(pc.localDescription);
        };
    };

    document.getElementById('connectBtn').onclick = async () => {
        await pc.setRemoteDescription(JSON.parse(document.getElementById('answerIn').value));
    };

    document.getElementById('sendBtn').onclick = () => {
        if (dc && dc.readyState === 'open' && msgInput.value.trim() !== "") {
            dc.send(msgInput.value);
            logMsg(msgInput.value, 'me');
            msgInput.value = '';
        }
    };

    // Send typing indicator when typing
    msgInput.addEventListener('input', () => {
        if (dc && dc.readyState === 'open') {
            dc.send("__typing__");
        }
    });
