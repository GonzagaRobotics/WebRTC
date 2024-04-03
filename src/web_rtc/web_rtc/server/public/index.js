let peerConnection = new RTCPeerConnection({ iceServers: [] });
let currentTrack;
const signalingChannel = new WebSocket("ws://localhost:8090");

/**
 * @param {string} name
 */
async function setStream(name) {
    const allDevices = await navigator.mediaDevices.enumerateDevices();

    const cameraId = allDevices.find(
        (device) => device.kind == "videoinput" && device.label.includes(name)
    );

    const stream = await navigator.mediaDevices.getUserMedia({
        video: {
            deviceId: {
                exact: cameraId.deviceId,
            },
        },
    });

    if (stream.getTracks().length == 0) {
        console.error(`Cannot find a track that matches ${name}`);
        return;
    }

    currentTrack = peerConnection.addTrack(stream.getTracks()[0], stream);
    const parameters = currentTrack.getParameters();
    if (!parameters.encodings) {
        parameters.encodings = [{}];
    }

    parameters.encodings[0].maxBitrate = 80000;
    parameters.encodings[0].maxFramerate = 15;
    parameters.encodings[0].scaleResolutionDownBy = 1.0;
    parameters.degradationPreference = "maintain-resolution";

    try {
        await currentTrack.setParameters(parameters);
    } catch (error) {
        console.error("Could not set parameters for video stream.");
    }
}

signalingChannel.onmessage = async (rawMessage) => {
    const message = JSON.parse(rawMessage.data);

    if (message.iceCandidate) {
        peerConnection.addIceCandidate(message.iceCandidate);
        return;
    }

    peerConnection.onconnectionstatechange = () => {
        switch (peerConnection.connectionState) {
            case "disconnected":
            case "closed":
            case "failed":
                if (currentTrack) {
                    console.log("Removing track");
                    peerConnection.removeTrack(currentTrack);
                    currentTrack = undefined;
                }
                console.log("Connection closed");
                peerConnection = new RTCPeerConnection({ iceServers: [] });
                break;
        }
    };

    peerConnection.addEventListener("icecandidate", (event) => {
        if (event.candidate) {
            signalingChannel.send(
                JSON.stringify({
                    iceCandidate: event.candidate,
                })
            );
        }
    });

    // await setStream("Integrated");
    await setStream("C970");

    const remoteDesc = new RTCSessionDescription(message.offer);
    peerConnection.setRemoteDescription(remoteDesc);

    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    signalingChannel.send(
        JSON.stringify({
            answer: answer,
        })
    );
};
