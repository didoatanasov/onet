/**
 * A WebRTC DataChannel JS Library
 */
"use strict";

(function(exports) {
  if (typeof require!== 'undefined') {
    require('webrtc-adapter');
  }

  function SignalMessage(type, sender, recipient, roomId, sdp) {
    return {
      type: type || '',
      sender: sender || '',
      recipient: recipient || '',
      roomId: roomId || '',
      sdp: sdp || ''
    }
  }

  function DataChannelMessage(type,payload) {
    return  {
      type: type ||'',
      payload:payload || ''
    };
  }

  /**
   * Init web socket signaling
   * @param address
   * @returns {Promise}
   */
  function initWebSocketConnection(address) {
    return new Promise(function (resolve, reject) {
      let ws = new WebSocket(address);
      ws.onopen = function (event) {


        (event.type === 'open') ? resolve(ws) : reject(event);
      };


    })
  }

  /**
   * Generate V4 GUID
   * @returns {string}
   */
  function guid() {
    let d = Date.now();
    if (window.performance && typeof window.performance.now === "function") {
      d += performance.now(); //use high-precision timer if available
    }
    let uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      let r = (d + Math.random() * 16) % 16 | 0;
      d = Math.floor(d / 16);
      return (c == 'x' ? r : (r & 0x3 | 0x8)).toString(16);
    });
    return uuid;

  }

  function Peer(options) {
    let self = this;

    return new Promise(function (resolve, reject) {


      self.ws = null;
      self.roomUUID = options.roomId;
      self.pc = null;
      self.wsAddress = options.wsAddress;
      self.channelReady = options.chanReadyCallback;
      self.onCloseSignalMessage = options.onCloseSignalMessage || onCloseSignalMessage;

      self.id = options.id || guid();
      self.caller = options.caller || false;
      self.calleeId = options.calleeId || guid();
      self.peerConnectionConfig = options.config || Peer.config;
      self.mediaConfig = options.mediaConfig || Peer.mediaConstraints;
      self.pc = new RTCPeerConnection(self.peerConnectionConfig);
      //setup ping
      self.ping = function (event) {
        let msg = new SignalMessage("PING");
        self.sendToSignalServer(msg);
      };
      // create DC
      let dataChannelOptions = {
        ordered: false, //no guaranteed delivery, unreliable but faster
        maxRetransmitTime: 10000, //milliseconds
      };
      self.dc = self.pc.createDataChannel("Message DataChannel", dataChannelOptions);

      setupDataChannel();


      self.pc.onicecandidate = function (event) {
        if (event.candidate) {
          let msg = new SignalMessage('ICE', self.id, self.calleeId, self.roomUUID, event.candidate);
          self.sendToSignalServer(msg);
        }
      };
      //Setup data channell
      function setupDataChannel() {
        self.dc.onopen = function (event) {
          self.channelReady(self.dc);
        }

      }

      //Start signaling
      initWebSocketConnection(self.wsAddress).then(function (socketConn) {
        self.ws = socketConn;
        socketConn.onmessage = onSignalMessage;
        //TODO ON close
        socketConn.onclose = self.onCloseSignalMessage;
        self.pingId = setInterval(self.ping, 30 * 1000);
        resolve(self);
      });


      // Receive loop for signaling
      function onSignalMessage(event) {
        let msg = JSON.parse(event.data);
        if (msg.type === 'OFFER') {
          msg.sdp.type = String(msg.sdp.type).toLowerCase();
          if (msg.sdp.description && typeof msg.sdp.sdp === 'undefined') { // sanitizing for android clients, TODO move to function
            msg.sdp.sdp =  msg.sdp.description;
            delete msg.sdp.description;
          }
          self.pc.setRemoteDescription(msg.sdp);
          self.pc.createAnswer().then(function (answer) {
            self.pc.setLocalDescription(answer);
            let msg = new SignalMessage('ANSWER', self.id, self.calleeId, self.roomUUID, answer);
            self.sendToSignalServer(msg);

          })
        } else if (msg.type === 'ANSWER') {
          msg.sdp.type = String(msg.sdp.type).toLowerCase();
          // msg.sdp.sdp =(typeof msg.sdp.sdp ==='undefined' ? msg.sdp.description : msg.sdp.sdp);
          if (msg.sdp.description && typeof msg.sdp.sdp === 'undefined') { // sanitizing for android clients, TODO move to function
            msg.sdp.sdp =  msg.sdp.description;
            delete msg.sdp.description;
          }
          self.pc.setRemoteDescription(msg.sdp);

        } else if (msg.type === 'ICE') {
          if (typeof msg.sdp.candidate === 'undefined' && msg.sdp.sdp) {
            msg.sdp.candidate = msg.sdp.sdp;
            delete msg.sdp.sdp;
          }
          self.pc.addIceCandidate(new RTCIceCandidate(msg.sdp));
        } else {
          console.log("UNKNOWN MESSAGE");
        }
      }

      function onCloseSignalMessage (event) {
        console.log(event.code);
      }


    })
  }

  /**
   * Recieve data message
   * @param callback
   */
  Peer.prototype.recieveMessageFromDataChannel = function () {
    let self = this;
    return new Promise(function (resolve, reject) {
      self.pc.ondatachannel = function (event) {
        event.channel.onmessage = function (msg) {
          resolve(msg.data);
        }
      }
    })

  };
  /**
   * Call other party
   */
  Peer.prototype.call = function () {

    let self = this;
    if (self.caller) {
      self.pc.createOffer(self.mediaConfig).then(function (offer) {
        self.pc.setLocalDescription(offer).then()
        {
          let msg = new SignalMessage('OFFER', self.id, self.calleeId, self.roomUUID, offer);
          self.sendToSignalServer(msg);
        }
      })
    }
  };

  Peer.prototype.waitForCall = function () {
    let self = this;
    if (!self.caller) {
      let msg = new SignalMessage("GET_OFFER", self.id, self.calleeId, self.roomUUID);
      self.sendToSignalServer(msg);
    }
  };

  /**
   * PC config
   * @type {{iceServers: [*]}}
   */
  Peer.config = {
    iceServers: [
      {
        urls: 'stun:stun.l.google.com:19302'
      }
    ]
  };
  /**
   * Offer default constrains
   * @type {{mandatory: {OfferToReceiveAudio: boolean, OfferToReceiveVideo: boolean, voiceActivityDetection: boolean, iceRestart: boolean}}}
   */
  Peer.mediaConstraints = {
    mandatory: {
      OfferToReceiveAudio: false,
      OfferToReceiveVideo: false,
      voiceActivityDetection: false,
      iceRestart: false
    }
  };
  /**
   * web socket send
   * @param message
   */
  Peer.prototype.sendToSignalServer = function sendToSignalServer(message) {
    let self = this;
    if (self.ws && message) {
      self.ws.send(typeof message === 'string' ? message : JSON.stringify(message))
    } else {
      console.error('send - Invalid socket or message:' + message);
    }
  };
  /**
   * Datachannel send
   * @param msg
   */
  Peer.prototype.send = function (msg) {
    let self = this;
    self.dc.send(typeof msg === 'string' ? msg : JSON.stringify(msg))
  };
  /**
   * Close server socket connection
   */
  Peer.prototype.closeSignalServer = function () {
    let self = this;
    self.ws.close();

  };

  exports.Peer = Peer;
  exports.DataChannelMessage = DataChannelMessage;
  exports.SignalMessage = SignalMessage;

})(typeof exports === 'undefined' ? this['peerModule']={}:exports);

