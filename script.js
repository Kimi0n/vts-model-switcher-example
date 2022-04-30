const PLUGIN_NAME = "VTSModelSwitcherExample";
const PLUGIN_DEVELOPER = "Kimion (Kimi0n)";
const VTS_PORT = 8001;

// Authentification class that holds the token.
class Auth{
    constructor() {
        this.token = null;
        this.appName = PLUGIN_NAME;
        this.devName = PLUGIN_DEVELOPER;
        this.tokenSaved = false;
        this.storageName = "VTS " + this.appName;
    }

    // Checks if a token is saved in local storage.
    checkForCredentials() {
        if(localStorage.getItem(this.storageName)) {
            this.tokenSaved = true;
            this.token = localStorage.getItem(this.storageName);
            return this.tokenAuth();
        } else {
            return this.requestToken();
        }
    }

    // Builds the session authentication request.
    tokenAuth() {
        let data = {
            "pluginName": this.appName,
            "pluginDeveloper": this.devName,
            "authenticationToken": this.token
        };

        let request = buildRequest("AuthenticationRequest", data);
        
        if(!this.tokenSaved) {
            localStorage.setItem(this.storageName, this.token);
        }

        return request;
    }

    // Builds the one time authentication token request (the one you'll have to allow in VTS once).
    requestToken() {
        let data = {
            "pluginName": this.appName,
            "pluginDeveloper": this.devName
        };

        let request = buildRequest("AuthenticationTokenRequest", data);

        return request;
    }

    // Removes token.
    invalidateToken() {
        localStorage.removeItem(this.storageName);
        this.tokenSaved = false;
    }
}

// Constants and variables.
const auth = new Auth();
let vtsConnection = null;
let modelList = new Array();

// Initializes the event listeners for the frontend.
function initHandlers() {
    document.getElementById("btnConnect").addEventListener('click', () => {
        connect(document.getElementById("inputPort").value);
    });

    document.getElementById("btnGetModels").addEventListener('click', () => {
        sendListModelsRequest();
    });
}

// Connects to the VTube Studio API and handles the communication.
function connect(port) {
    let socket = new WebSocket("ws://localhost:" + port);

    socket.addEventListener('open', function (event) {
        console.log("Connecting to VTubeStudio on port " + port);
        socket.send(auth.checkForCredentials());
        vtsConnection = socket;
    });

    socket.addEventListener('error', function (event) {
        connectionError(event);
    });

    socket.addEventListener('message', function (event) {
        parseResponse(JSON.parse(event.data), socket);
    });
}

// Creates a valid request to the VTube Studio API.
function buildRequest(requestType, data) {
    const request = {
        apiName: "VTubeStudioPublicAPI",
        apiVersion: "1.0",
        messageType: requestType,
        data: data
    };

    return JSON.stringify(request);
}

// Creates a valid request to the VTube Studio API.
function buildRequestWithoutData(requestType) {
    const request = {
        apiName: "VTubeStudioPublicAPI",
        apiVersion: "1.0",
        messageType: requestType
    };

    return JSON.stringify(request);
}

// Displays error messages to the console.
function connectionError(error) {
    console.error("Connection error: " + JSON.stringify(error));
}

// Parses the response from the VTube Studio API.
function parseResponse(response, connection) {

    // Response to APIError
    if (response.messageType == "APIError") {
        console.error(response.data);
    }

    // Response to authentication. 
    if (!auth.token && response.messageType == "AuthenticationTokenResponse") {
        auth.token = response.data.authenticationToken;
        connection.send(auth.tokenAuth());
    } else if (response.messageType == "AuthenticationResponse") {
        if (response.data.authenticated == true) {
            setStatusToIsConnected(true);
            console.log("Connected and Authenticated to VTubeStudio!")
        } else {
            setStatusToIsConnected(false);
            auth.invalidateToken();
            console.log(response.data.reason);
        }
    }

    // Response to model request
    if (response.messageType == "AvailableModelsResponse") {
        let htmlModelList = document.getElementById("modelList");

        if (response.data.numberOfModels > 0) {
            htmlModelList.innerHTML = "";

            response.data.availableModels.forEach(element => {
                modelList.push(element);

                if(element.modelLoaded) {
                    htmlModelList.innerHTML += "<p class=\"loadedModel\"> <button>Active</button>" + element.modelName + "</p>";
                } else {
                    htmlModelList.innerHTML += "<p><button onclick=\"sendSwitchModelRequest(\'" + element.modelID + "\')\">Switch</button>" + element.modelName + "</p>";
                }
            });
        } else {
            htmlModelList.innerHTML += "No models available!";
        }
    }

    // Refresh list when model is loaded.
    if(response.messageType == "ModelLoadResponse") {
        sendListModelsRequest();
    }
}

// Blocks the connect button and displays the model panel when connected.
function setStatusToIsConnected(isConnected) {
    if (isConnected) {
        document.getElementById("connectionState").textContent = "Status: Connected!";
        document.getElementById("btnConnect").disabled = true;
        document.getElementById("modelPanel").style.display = "block";
    } else {
        document.getElementById("connectionState").textContent = "Status: Not Connected!";
        document.getElementById("btnConnect").disabled = false;
        document.getElementById("modelPanel").style.display = "none";
    }
}

function sendListModelsRequest() {
    const request = buildRequestWithoutData("AvailableModelsRequest");
    vtsConnection.send(request);
}

function sendSwitchModelRequest(modelID) {
    const request = buildRequest("ModelLoadRequest", {
        "modelID": modelID
    });

    vtsConnection.send(request);
}

// Main
connect(VTS_PORT);
initHandlers();