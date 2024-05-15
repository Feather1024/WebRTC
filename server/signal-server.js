const SIGNAL_TYPE_JOIN = "join"; //浏览器->服务器,加入房间;服务器->浏览器，加入结果
const SIGNAL_TYPE_RESP_JOIN = "resp-join"; //服务器->浏览器，房间已有谁
const SIGNAL_TYPE_LEAVE = "leave"; //浏览器->服务器，请求离开房间
const SIGNAL_TYPE_NEW_PEER = "new-peer"; //服务器->浏览器，新加入的谁
const SIGNAL_TYPE_PEER_LEAVE = "peer-leave"; //服务器->浏览器，谁离开了房间
const SIGNAL_TYPE_OFFER = "offer"; //
const SIGNAL_TYPE_ANSWER = "answer";
const SIGNAL_TYPE_CANDIDATE = "candidate";



/** ----- ZeroRTCMap ----- */
class ZeroRTCMap {
    constructor() {
        this._entrys = new Array();
        // 插入
        this.put = function (key, value) {
            if (key == null || key == undefined) {
                return;
            }
            var index = this._getIndex(key);
            if (index == -1) {
                var entry = new Object();
                entry.key = key;
                entry.value = value;
                this._entrys[this._entrys.length] = entry;
            } else {
                this._entrys[index].value = value;
            }
        };
        // 根据key获取value
        this.get = function (key) {
            var index = this._getIndex(key);
            return (index != -1) ? this._entrys[index].value : null;
        };
        // 移除key-value
        this.remove = function (key) {
            var index = this._getIndex(key);
            if (index != -1) {
                this._entrys.splice(index, 1);
            }
        };
        // 清空map
        this.clear = function () {
            this._entrys.length = 0;
        };
        // 判断是否包含key
        this.contains = function (key) {
            var index = this._getIndex(key);
            return (index != -1) ? true : false;
        };
        // map内key-value的数量
        this.size = function () {
            return this._entrys.length;
        };
        // 获取所有的key
        this.getEntrys = function () {
            return this._entrys;
        };
        // 内部函数
        this._getIndex = function (key) {
            if (key == null || key == undefined) {
                return -1;
            }
            var _length = this._entrys.length;
            for (var i = 0; i < _length; i++) {
                var entry = this._entrys[i];
                if (entry == null || entry == undefined) {
                    continue;
                }
                if (entry.key === key) { // equal
                    return i;
                }
            }
            return -1;
        };
    }
}



var ws = require("nodejs-websocket")
var port = 8099

var roomTableMap = new ZeroRTCMap();


function Client(uid, conn, roomId) {
    this.uid = uid;
    this.conn = conn;
    this.roomId = roomId;
}


function handleJoin(message, conn) {
    var roomId = message.roomId;
    var uid = message.uid;

    console.log("uid: " + uid + " try to join room: " + roomId);
    var roomMap = roomTableMap.get(roomId);
    if (roomMap == null) {
        roomMap = new ZeroRTCMap();
        roomTableMap.put(roomId, roomMap);
    }
    // else if (roomMap.size() > 2) {
    //     console.error("roomId: " + roomId + " 已经有三人存在，请使用其他房间");
    //     conn.sendText("roomId: " + roomId + " 已经有三人存在，请使用其他房间");
    //     return null;
    // }


    var client = new Client(uid, conn, roomId);
    roomMap.put(uid, client);
    if (roomMap.size() > 1) {
        //房间里有人，加上新进来的人，需要通知对方
        var clients = roomMap.getEntrys();
        for (var i in clients) {
            var remoteUid = clients[i].key;
            if (remoteUid != uid) {
                var jsonMsg = {
                    'cmd': SIGNAL_TYPE_NEW_PEER,
                    //把自己的uid发给对方
                    'remoteUid': uid
                };
                var msg = JSON.stringify(jsonMsg);
                var remoteClient = roomMap.get(remoteUid);
                console.info("new-peer: " + msg);
                remoteClient.conn.sendText(msg);

                jsonMsg = {
                    'cmd': SIGNAL_TYPE_RESP_JOIN,
                    //把房间里其他人的uid发给自己
                    'remoteUid': remoteUid
                };

                msg = JSON.stringify(jsonMsg);
                console.info("resp-join" + msg);
                conn.sendText(msg);

            }
        }
    }

    return client;
}

function handleLeave(message) {
    var roomId = message.roomId;
    var uid = message.uid;

    console.log("uid: " + uid + " try to leave room: " + roomId);
    var roomMap = roomTableMap.get(roomId);
    if (roomMap == null) {
        console.error("Can not find roomId: " + roomId);
        return;
    }

    roomMap.remove(uid);    //删除发送者
    //房间里还有其他人
    if (roomMap.size() >= 1) {
        var clients = roomMap.getEntrys();
        for (var i in clients) {
            var jsonMsg = {
                'cmd': SIGNAL_TYPE_PEER_LEAVE,
                'uid': uid
            };
            var msg = JSON.stringify(jsonMsg);
            var remoteUid = clients[i].key;
            var remoteClient = roomMap.get(remoteUid);
            if (remoteClient) {
                console.info("Notify peer: " + remoteClient.uid + ", uid: " + uid + " leave");
                remoteClient.conn.sendText(msg);
            }
        }
    }
}

function handleForceLeave(client) {
    var roomId = client.roomId;
    var uid = client.uid;

    var roomMap = roomTableMap.get(roomId);
    if (roomMap == null) {
        console.error("handleForceLeave Can not find roomId: " + roomId);
        return;
    }

    //房间在，再去找uid在不在
    if (!roomMap.contains(uid)) {
        console.error("uid: " + uid + " have left");
        return;
    }

    //到这里，说明客户端没有正常离开
    console.log("uid: " + uid + " force leave room: " + roomId);

    roomMap.remove(uid);    //删除发送者
    //房间里还有其他人
    if (roomMap.size() >= 1) {
        var clients = roomMap.getEntrys();
        for (var i in clients) {
            var jsonMsg = {
                'cmd': SIGNAL_TYPE_PEER_LEAVE,
                'uid': uid
            };
            var msg = JSON.stringify(jsonMsg);
            var remoteUid = clients[i].key;
            var remoteClient = roomMap.get(remoteUid);
            if (remoteClient) {
                console.info("Notify peer: " + remoteClient.uid + ", uid: " + uid + " leave");
                remoteClient.conn.sendText(msg);
            }
        }
    }
}

function handleOffer(message) {
    var roomId = message.roomId;
    var uid = message.uid;
    var remoteUid = message.remoteUid;

    console.log("handleOffer uid: " + uid + " transfer offer to remoteUid: " + remoteUid);
    var roomMap = roomTableMap.get(roomId);
    if (roomMap == null) {
        console.error("Can not find roomId: " + roomId);
        return;
    }

    if (roomMap.get(uid) == null) {
        console.error("handleOffer can't find the uid: " + uid);
        return;
    }

    var remoteClient = roomMap.get(remoteUid);
    if (remoteClient) {
        var msg = JSON.stringify(message);
        remoteClient.conn.sendText(msg);
    }
    else {
        console.error("can't find remoteUid: " + remoteUid);
        return;
    }
}

function handleAnswer(message) {
    var roomId = message.roomId;
    var uid = message.uid;
    var remoteUid = message.remoteUid;

    console.log("handleAnswer uid: " + uid + " transfer answer to remoteUid: " + remoteUid);
    var roomMap = roomTableMap.get(roomId);
    if (roomMap == null) {
        console.error("Can not find roomId: " + roomId);
        return;
    }

    if (roomMap.get(uid) == null) {
        console.error("handleAnswer can't find the uid: " + uid);
        return;
    }

    var remoteClient = roomMap.get(remoteUid);
    if (remoteClient) {
        var msg = JSON.stringify(message);
        remoteClient.conn.sendText(msg);
    }
    else {
        console.error("can't find remoteUid: " + remoteUid);
        return;
    }
}

function handleCandidate(message) {
    var roomId = message.roomId;
    var uid = message.uid;
    var remoteUid = message.remoteUid;

    console.log("handleCandidate uid: " + uid + " transfer candidate to remoteUid: " + remoteUid);
    var roomMap = roomTableMap.get(roomId);
    if (roomMap == null) {
        console.error("Can not find roomId: " + roomId);
        return;
    }

    if (roomMap.get(uid) == null) {
        console.error("handleCandidate can't find the uid: " + uid);
        return;
    }

    var remoteClient = roomMap.get(remoteUid);
    if (remoteClient) {
        var msg = JSON.stringify(message);
        remoteClient.conn.sendText(msg);
    }
    else {
        console.error("can't find remoteUid: " + remoteUid);
        return;
    }
}

var server = ws.createServer(function (conn) {
    console.log("创建一个新的链接……");

    conn.client = null;   //对应的客户端信息
    //conn.sendText("我收到你的链接了……");

    conn.on("text", function (str) {
        //console.log("recv msg: " + str);

        var jsonMsg = JSON.parse(str);
        switch (jsonMsg.cmd) {
            case SIGNAL_TYPE_JOIN:
                conn.client = handleJoin(jsonMsg, conn);
                break;
            case SIGNAL_TYPE_LEAVE:
                handleLeave(jsonMsg);
                break;
            case SIGNAL_TYPE_OFFER:
                handleOffer(jsonMsg);
                break;
            case SIGNAL_TYPE_ANSWER:
                handleAnswer(jsonMsg);
                break;
            case SIGNAL_TYPE_CANDIDATE:
                handleCandidate(jsonMsg);
                break;
        }
    });

    conn.on("close", function (code, reason) {
        console.log("链接关闭 code: " + code + ", reason: " + reason);
        if (conn.client != null) {
            //强制客户端从房间退出
            handleForceLeave(conn.client);
        }
    });

    conn.on("error", function (err) {
        console.log("监听到错误: " + err);
    });
}).listen(port);