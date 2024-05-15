'use strict'

//const { error } = require("console");


const SIGNAL_TYPE_JOIN = "join"; //浏览器->服务器,加入房间;服务器->浏览器，加入结果
const SIGNAL_TYPE_RESP_JOIN = "resp-join"; //服务器->浏览器，房间已有谁
const SIGNAL_TYPE_LEAVE = "leave"; //浏览器->服务器，请求离开房间
const SIGNAL_TYPE_NEW_PEER = "new-peer"; //服务器->浏览器，新加入的谁
const SIGNAL_TYPE_PEER_LEAVE = "peer-leave"; //服务器->浏览器，谁离开了房间
const SIGNAL_TYPE_OFFER = "offer"; //
const SIGNAL_TYPE_ANSWER = "answer";
const SIGNAL_TYPE_CANDIDATE = "candidate";

// const serverUrl="ws://192.168.241.131:8099"
// const serverUrl="ws://120.27.201.122:8099"
const serverUrl = "ws://120.27.201.122:8099"


var localVideo = document.querySelector('#localVideo');
var remoteVideo = document.querySelector('#remoteVideo');
var remoteVideo2 = document.querySelector('#remoteVideo2');
var remoteVideo3 = document.querySelector('#remoteVideo3');
var remoteVideo4 = document.querySelector('#remoteVideo4');

var localStream = null;
var remoteStream = null;

var localUserId = Math.random().toString(36).substr(2);

var roomId = 0;

var zeroRTCEngine;


//保存uid与对应的pc链接
var usersPc = new Map();
//保存哪个窗口显示哪个uid的视频
var video_uid = new Map();


function freshNum() {
    var userCount = usersPc.size;
    // 获取HTML元素  
    let count = document.getElementById('userCount');
    // 设置该元素的内容为count的值  
    count.textContent = "房间人数：" + userCount;
}

freshNum();


var ZeroRTCEngine = function (wsUrl) {
    this.init(wsUrl);
    zeroRTCEngine = this;
    return this;
}

ZeroRTCEngine.prototype.init = function (wsUrl) {
    //设置websocket url  
    this.wsUrl = wsUrl;
    this.signaling = null;
}

ZeroRTCEngine.prototype.createWebsocket = function () {
    zeroRTCEngine = this;
    zeroRTCEngine.signaling = new WebSocket(this.wsUrl);

    zeroRTCEngine.signaling.onopen = function () {
        zeroRTCEngine.onOpen();
    }

    zeroRTCEngine.signaling.onmessage = function (ev) {
        zeroRTCEngine.onMessage(ev);
    }

    zeroRTCEngine.signaling.onerror = function (ev) {
        zeroRTCEngine.onError(ev);
    }

    zeroRTCEngine.signaling.onclose = function (ev) {
        zeroRTCEngine.onClose(ev);
    }
}


ZeroRTCEngine.prototype.onOpen = function () {
    console.log("Websocket open");
}

ZeroRTCEngine.prototype.onMessage = function (ev) {
    //console.log("onMessage: " + ev.data);
    var jsonMsg = null;
    try {
        jsonMsg = JSON.parse(ev.data);
    }
    catch (e) {
        console.warn("onMessage parse failed: " + e);
        return;
    }
    switch (jsonMsg.cmd) {
        case SIGNAL_TYPE_NEW_PEER:
            handleRemoteNewPeer(jsonMsg);
            break;
        case SIGNAL_TYPE_RESP_JOIN:
            handleResponseJoin(jsonMsg);
            break;
        case SIGNAL_TYPE_PEER_LEAVE:
            handleRemotePeerLeave(jsonMsg);
            break;
        case SIGNAL_TYPE_OFFER:
            handleRemoteOffer(jsonMsg);
            break;
        case SIGNAL_TYPE_ANSWER:
            handleRemoteAnswer(jsonMsg);
            break;
        case SIGNAL_TYPE_CANDIDATE:
            handleRemoteCandidate(jsonMsg);
            break;

    }
}

ZeroRTCEngine.prototype.onError = function (ev) {
    console.log("onError: " + ev.data);
}

ZeroRTCEngine.prototype.onClose = function (ev) {
    console.log("onClose -> code: " + ev.code + ", reason: " + EventTarget.reason);
}

ZeroRTCEngine.prototype.sendMessage = function (msg) {
    this.signaling.send(msg);
}


function handleRemoteNewPeer(message) {
    console.info("handleRemoteNewPeer, remoteUid: " + message.remoteUid);
    var remoteUserId = message.remoteUid;

    //有new peer后创建offer
    doOffer(remoteUserId);
}

function handleResponseJoin(message) {
    console.info("handleResponseJoin, remoteUid: " + message.remoteUid);
}

function handleRemotePeerLeave(message) {

    var remoteUid = message.uid;
    video_uid.get(remoteUid).srcObject = null;
    video_uid.delete(remoteUid);

    // remoteVideo.srcObject = null;
    console.info("handleRemotePeerLeave, remoteUid: " + message.remoteUid);
    if (usersPc.get(remoteUid) != null) {
        usersPc.get(remoteUid).close();
        usersPc.delete(remoteUid);
    }

    freshNum();
}

function handleRemoteOffer(message) {
    console.info("handleRemoteOffer");

    //接收到别人的offer，说明房间里有人，添加那个人的pc
    var remoteUid = message.uid;
    if (usersPc.has(remoteUid) == false) {
        var pc = createPeerConnection(remoteUid);
        usersPc.set(remoteUid, pc);
        freshNum();
    }

    //设置远端的sdp
    var desc = JSON.parse(message.msg);
    usersPc.get(remoteUid).setRemoteDescription(desc);
    doAnswer(remoteUid);

    // if (pc == null) {
    //     createPeerConnection();
    // }
    // //设置远端的sdp
    // var desc = JSON.parse(message.msg);
    // pc.setRemoteDescription(desc);
    // doAnswer();
}

function handleRemoteAnswer(message) {
    console.info("handleRemoteAnswer");
    var remoteUid = message.uid;

    var desc = JSON.parse(message.msg);
    usersPc.get(remoteUid).setRemoteDescription(desc);

    //pc.setRemoteDescription(desc);
}

function handleRemoteCandidate(message) {
    console.info("handleRemoteCandidate");
    var remoteUid = message.uid;
    var candidate = JSON.parse(message.msg);
    usersPc.get(remoteUid).addIceCandidate(candidate).catch(e => { console.error("addIceCandidate failed: " + e.name) });
}

function doJoin(roomId) {
    var jsonMsg = {
        'cmd': 'join',
        'roomId': roomId,
        'uid': localUserId,
    };

    var message = JSON.stringify(jsonMsg);
    zeroRTCEngine.sendMessage(message);

    usersPc.set(localUserId, null);

    freshNum();

    console.info("doJoin message: " + message);
}


function doLeave() {
    var jsonMsg = {
        'cmd': 'leave',
        'roomId': roomId,
        'uid': localUserId,
    };

    var message = JSON.stringify(jsonMsg);
    zeroRTCEngine.sendMessage(message);

    console.info("doLeave message: " + message);
    hangUp();
}


function hangUp() {
    //关闭显示对方的画面
    //remoteVideo.srcObject = null;
    //关闭本地画面
    //localVideo.srcObject = null;

    for (let key of video_uid.keys()) {
        video_uid.get(key).srcObject = null;
        video_uid.delete(key);
    }

    closeLocalStream();

    for (let key of usersPc.keys()) {
        if (usersPc.get(key) != null) {
            //关闭RTCPeerConnection
            usersPc.get(key).close();
            usersPc.delete(key);
        }
    }
    freshNum();
}

function closeLocalStream() {
    if (localStream != null) {
        localStream.getTracks().forEach((track) => {
            track.stop();
        });
    }
}


function handleIceCandidate(event, remoteUid) {
    console.info("handleIceCandidate");
    if (event.candidate) {
        var jsonMsg = {
            'cmd': 'candidate',
            'roomId': roomId,
            'uid': localUserId,
            'remoteUid': remoteUid,
            'msg': JSON.stringify(event.candidate)
        };
        var message = JSON.stringify(jsonMsg);
        zeroRTCEngine.sendMessage(message);
        // console.info("handleIceCandidate message: " + message);
        console.info("send candidate message");
    }
    else {
        //不再请求打洞
        console.warn("End of candidates");
    }
}

function handleRemoteStreamAdd(event, remoteUid) {
    console.info("handleRemoteStreamAdd, videoSize = " + video_uid.size);

    if (video_uid.has(remoteUid) == true) {
        remoteStream = event.streams[0];
        video_uid.get(remoteUid).srcObject = remoteStream;
    }
    else {
        switch (video_uid.size) {
            case 1:
                video_uid.set(remoteUid, remoteVideo);
                remoteStream = event.streams[0];
                remoteVideo.srcObject = remoteStream;
                break;
            case 2:
                video_uid.set(remoteUid, remoteVideo2);
                remoteStream = event.streams[0];
                remoteVideo2.srcObject = remoteStream;
                break;
            case 3:
                video_uid.set(remoteUid, remoteVideo3);
                remoteStream = event.streams[0];
                remoteVideo3.srcObject = remoteStream;
                break;
            case 4:
                video_uid.set(remoteUid, remoteVideo4);
                remoteStream = event.streams[0];
                remoteVideo4.srcObject = remoteStream;
                break;
        }
    }

    // remoteStream = event.streams[0];
    // remoteVideo.srcObject = remoteStream;
}

// function handleConnectionStateChange() {
//     if (pc != null) {
//         console.info("ConnectionState -> " + pc.connectionState);
//     }
// }

// function handleIceConnectionStateChange() {
//     if (pc != null) {
//         console.info("IceConnectionState -> " + pc.iceConnectionState);
//     }
// }

function createPeerConnection(remoteUid) {

    var defaultConfiguration = {
        bundlePolicy: "max-bundle",
        rtcpMuxPolicy: "require",
        iceTransportPolicy: "all",    //relay只有中继模式，all允许P2P
        //修改ice数组测试效果，需要进行封装
        iceServer: [
            {
                "urls": [
                    "turn:192.168.241.131:3478?transport=udp",
                    "turn:192.168.241.131:3478?transport=tcp"
                ],
                "username": "root",
                "credential": "123456"
            },
            {
                "urls": [
                    "stun:192.168.241.131:3478"
                ]
            }
        ]
    };

    var pc = new RTCPeerConnection(defaultConfiguration);
    pc.onicecandidate = (event) => handleIceCandidate(event, remoteUid);
    pc.ontrack = (event) => handleRemoteStreamAdd(event, remoteUid);
    // pc.onconnectionstatechange = handleConnectionStateChange;
    // pc.oniceconnectionstatechange = handleIceConnectionStateChange;

    localStream.getTracks().forEach((track) => pc.addTrack(track, localStream));

    return pc;
}

function createOfferAndSendMessage(session, remoteUid) {
    var pc = usersPc.get(remoteUid);

    //设置本地sdp并且发送出去
    pc.setLocalDescription(session)
        .then(function () {
            var jsonMsg = {
                'cmd': 'offer',
                'roomId': roomId,
                'uid': localUserId,
                'remoteUid': remoteUid,
                'msg': JSON.stringify(session)
            };
            var message = JSON.stringify(jsonMsg);
            zeroRTCEngine.sendMessage(message);
            // console.info("send offer message: " + message);
            console.info("send offer message");
        })
        .catch((error) => console.error("offer setLocalDescription failed: " + error))
}

function handleCreateOfferError(error) {
    console.error("handleCreateOfferError: " + error);
}

function createAnswerAndSendMessage(session, remoteUid) {
    usersPc.get(remoteUid).setLocalDescription(session)
        .then(function () {
            var jsonMsg = {
                'cmd': 'answer',
                'roomId': roomId,
                'uid': localUserId,
                'remoteUid': remoteUid,
                'msg': JSON.stringify(session)
            };
            var message = JSON.stringify(jsonMsg);
            zeroRTCEngine.sendMessage(message);
            // console.info("send answer message: " + message);
            console.info("send answer message");
        })
        .catch((error) => console.error("answer setLocalDescription failed: " + error))
}

function handleCreateAnswerError(error) {
    console.error("handleCreateAnswerError: " + error);
}

function doOffer(remoteUid) {
    // 创建RTCPeerConnection
    if (usersPc.has(remoteUid) == false) {
        var pc = createPeerConnection(remoteUid);
        usersPc.set(remoteUid, pc);
        freshNum();
    }
    usersPc.get(remoteUid).createOffer()
        .then(session => { createOfferAndSendMessage(session, remoteUid); })
        .catch(handleCreateOfferError);

}

function doAnswer(remoteUid) {
    usersPc.get(remoteUid).createAnswer()
        .then(session => { createAnswerAndSendMessage(session, remoteUid); })
        .catch(handleCreateAnswerError);
}


function openLocalStream(stream) {
    console.log('Open local stream');
    doJoin(roomId);
    video_uid.set(localUserId, localVideo);
    localVideo.srcObject = stream;
    localStream = stream;
}


function initLocalStream() {
    navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true
    })
        .then(openLocalStream)
        .catch((e) => alert("getUserMadia() error: " + e.name));
}


zeroRTCEngine = new ZeroRTCEngine(serverUrl);
zeroRTCEngine.createWebsocket();


document.getElementById('joinBtn').onclick = function () {
    roomId = document.getElementById('zero-roomId').value;
    if (roomId == "" || roomId == "请输入房间ID") {
        alert("请输入房间ID");
        return;
    }
    console.log("加入按钮被点击，roomId = ", roomId);
    //初始化本地码流
    initLocalStream();
}

document.getElementById('leaveBtn').onclick = function () {
    roomId = document.getElementById('zero-roomId').value;
    if (roomId == "" || roomId == "请输入房间ID") {
        alert("请输入房间ID");
        return;
    }
    console.log("离开按钮被点击");
    doLeave();
}

