let map = document.getElementById("map");
let w = map.offsetWidth, h = map.offsetHeight;

let nodes = {};
let paths = [];
let nextId = 0;
let selectedNode = null;
let lastNode = null;
let isModalActive = true;
let geoRequestLock = false;

window.onresize = () => {
    w = map.offsetWidth;
    h = map.offsetHeight;
    displayNodes();
}

const startNodeBtn = document.getElementById("start-node-btn");
const resetBtn = document.getElementById("reset-btn");
const pingBtn = document.getElementById("ping-btn");
const clrPingBtn = document.getElementById("clr-ping-btn");
const fetchBtn = document.getElementById("fetch-btn");
const publishBtn = document.getElementById("publish-btn");

const mapNodes = document.getElementById("map-nodes")

const mapButtons = document.getElementById("map-buttons");
const addPathBtn = document.getElementById("add-path-btn");

const pathModal = document.getElementById("path-modal");
const pathModalCloseBtn = pathModal.querySelector(".close-btn");
const pathModalConfirmBtn = pathModal.querySelector(".create-btn");
const pathModalDescription = pathModal.querySelector("input");

const saveModal = document.getElementById("save-modal");
const saveModalCloseBtn = saveModal.querySelector(".close-btn");
const saveModalConfirmBtn = saveModal.querySelector(".create-btn");
const saveModalEmail = saveModal.querySelector("input");

const fetchModal = document.getElementById("fetch-modal");
const fetchModalCloseBtn = fetchModal.querySelector(".close-btn");
const fetchModalConfirmBtn = fetchModal.querySelector(".create-btn");
const fetchModalEmail = fetchModal.querySelector("input");

mapButtons.style.display = "none";
pathModal.style.display = "none";
saveModal.style.display = "none";
fetchModal.style.display = "none";

// ----------------------------------- data rendering -----------

function getGeoBoundaries() {
    const vals = Object.values(nodes);

    if (vals.length === 0) {
        return [-1, 1, -1, 1];
    } else if (vals.length === 1) {
        const {longitude, latitude} = vals[0];
        return [longitude-10, longitude+10, latitude-10, latitude+10];
    }

    let minLong = Infinity, minLat = Infinity
    let maxLong = -Infinity, maxLat = -Infinity;

    for (const {longitude, latitude} of vals) {
        minLong = Math.min(minLong, longitude);
        minLat = Math.min(minLat, latitude);
        maxLong = Math.max(maxLong, longitude);
        maxLat = Math.max(maxLat, latitude);
    }

    const longPadding = (maxLong - minLong) * 0.1;
    const latPadding = (maxLat - minLat) * 0.1;
    return [
        minLong - longPadding,
        maxLong + longPadding,
        minLat - latPadding,
        maxLat + latPadding,
    ];
}

// current algorithm scales x and y independently, could change to scale together
function displayNodes() {
    // todo: draw paths somehow
    const viewWidth = map.offsetWidth;
    const viewHeight = map.offsetHeight;
    const [minLong, maxLong, minLat, maxLat] = getGeoBoundaries();

    const coordWidth = maxLat - minLat;
    const coordHeight = maxLong - minLong;

    const screenCoords = {};

    mapNodes.innerHTML = '';

    for (const [k, node] of Object.entries(nodes)) {
        const {longitude, latitude} = node;
        const nodeElement = document.createElement("div");

        const child = document.createElement("div");
        nodeElement.appendChild(child);

        const latAlpha = (latitude - minLat) / coordWidth;
        const longAlpha = (longitude - minLong) / coordHeight;

        nodeElement.style.left = String(viewWidth * latAlpha) + "px";
        nodeElement.style.bottom = String(viewHeight * longAlpha) + "px";

        screenCoords[k] = [viewWidth * latAlpha, viewHeight * longAlpha];

        if (lastNode == node) {
            nodeElement.classList.add("last-node");
        }
        if (node.isRoot) {
            nodeElement.classList.add("root-node");
        }

        if (node.isPing) {
            nodeElement.classList.add("ping-node");
        } else {
            nodeElement.addEventListener("click", (e) => {
                selectedNode = selectedNode === node ? null : node;
                mapNodes.childNodes.forEach(n => n.classList.remove("selected"));
                e.target.classList.add("selected");
                if (selectedNode) {
                    mapButtons.style.display = "flex";
                } else {
                    mapButtons.style.display = "none";
                }
            });
        }

        nodeElement.classList.add("node");
        mapNodes.appendChild(nodeElement);
    }

    for (const path of paths) {
        const fromPos = screenCoords[path.from];
        const toPos = screenCoords[path.to];

        const dx = toPos[0] - fromPos[0];
        const dy = toPos[1] - fromPos[1];

        const distance = Math.sqrt(Math.pow(dx, 2) + Math.pow(dy, 2));
        const angle = Math.atan(dy / dx);

        const element = document.createElement("div");
        element.style.width = `${distance}px`;
        element.style.left = `${fromPos[0]}px`;
        element.style.bottom = `${fromPos[1]}px`;
        element.style.transform = `translateY(-5px) rotate(${-angle}rad)`;


        element.addEventListener("click", (e) => {
            // todo: should have a popup to edit or delete or whatever
        });

        element.classList.add("path");
        mapNodes.appendChild(element);
    }
}

// test function for viewing draw algorithm with a bunch of nodes
function addRandomNode() {
    const node = {
        longitude: (Math.random() - 0.5) * 100,
        latitude: (Math.random() - 0.5) * 100,
    };
    nodes[nextId++] = node;
    lastNode = node;
    displayNodes();
}

// delete this too
document.addEventListener("keydown", (e) => {
    if (e.key == "e") {
        addRandomNode();
    }
})

// ----------------------------------- topbar buttons -----------

startNodeBtn.addEventListener("click", () => {
    // todo should require building data since is a start node
    if (startNodeBtn.classList.contains("disabled")) {
        return;
    }
    startNodeBtn.classList.add("disabled");

    const options = {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
    };

    navigator.geolocation.getCurrentPosition(
        (pos) => {
            const node = {
                longitude: pos.coords.longitude,
                latitude: pos.coords.latitude,
                altitude: pos.coords.altitude,
                heading: pos.coords.heading,
                isRoot: true,
            };
            nodes[nextId++] = node;
            displayNodes();
            startNodeBtn.classList.remove("disabled");
        },
        (err) => {
            console.log("Couldn't get position: ", err);
            startNodeBtn.classList.remove("disabled");
        },
        options,
    );
});

pingBtn.addEventListener("click", () => {
    if (pingBtn.classList.contains("disabled")) {
        return;
    }
    pingBtn.classList.add("disabled");

    for (const [k, node] of Object.entries(nodes)) {
        if (node.isPing) {
            delete nodes[k];
        }
    }

    const options = {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
    };

    navigator.geolocation.getCurrentPosition(
        (pos) => {
            const node = {
                longitude: pos.coords.longitude,
                latitude: pos.coords.latitude,
                altitude: pos.coords.altitude,
                heading: pos.coords.heading,
                isPing: true,
            };
            nodes[nextId++] = node;
            displayNodes();
            pingBtn.classList.remove("disabled");
        },
        (err) => {
            console.log("Couldn't get position: ", err);
            pingBtn.classList.remove("disabled");
        },
        options,
    );
});

resetBtn.addEventListener("click", () => {
    nodes = {};
    paths = [];
    displayNodes();
});

clrPingBtn.addEventListener("click", () => {
    for (const [k, node] of Object.entries(nodes)) {
        if (node.isPing) {
            delete nodes[k];
            displayNodes();
        }
    }
});

publishBtn.addEventListener("click", async () => {
    saveModal.style.display = "flex";
    saveModalEmail.value = "";
    saveModalConfirmBtn.classList.add("incomplete");
});

fetchBtn.addEventListener("click", async () => {
    fetchModal.style.display = "flex";
    fetchModalEmail.value = "";
    fetchModalConfirmBtn.classList.add("incomplete");
});

// ----------------------------------- map buttons --------------

addPathBtn.addEventListener("click", () => {
    if (!selectedNode) {
        return; // shouldn't happen
    }
    pathModal.style.display = "flex";
    const input = pathModal.querySelector("input");
    input.value = "";
    pathModalConfirmBtn.classList.add("incomplete");
});

// ----------------------------------- path modal --------------

pathModalCloseBtn.addEventListener("click", () => {
    pathModal.style.display = "none";
});

pathModalConfirmBtn.addEventListener("click", () => {
    if (geoRequestLock) {
        return;
    }
    if (pathModalConfirmBtn.classList.contains("incomplete")) {
        return;
    }

    geoRequestLock = true;
    pathModalConfirmBtn.innerHTML = "saving...";

    const options = {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
    };

    // todo: fix all this garbage

    navigator.geolocation.getCurrentPosition(
        (pos) => {
            const node = {
                longitude: pos.coords.longitude,
                latitude: pos.coords.latitude,
                altitude: pos.coords.altitude,
                heading: pos.coords.heading,
            };

            const path = {
                from: Object.keys(nodes).find(k => nodes[k] === selectedNode),
                to: String(nextId),
                description: pathModalDescription.value,
            };

            nodes[nextId++] = node;
            paths.push(path);

            lastNode = node;
            displayNodes();
            pingBtn.classList.remove("disabled");
            geoRequestLock = false;
            pathModalConfirmBtn.innerHTML = "Make Node";
            pathModal.style.display = "none";
        },
        (err) => {
            console.log("Couldn't get position: ", err);
            pingBtn.classList.remove("disabled");
            geoRequestLock = false;
            pathModalConfirmBtn.innerHTML = "Err making node";
        },
        options,
    );
});

pathModal.querySelectorAll("input").forEach(inp => inp.addEventListener("change", () => {
    for (const box of pathModal.querySelectorAll("input")) {
        if (box.value == "") {
            pathModalConfirmBtn.classList.add("incomplete");
            return;
        }
    }
    pathModalConfirmBtn.classList.remove("incomplete");
}));

// ----------------------------------- save modal --------------

saveModalCloseBtn.addEventListener("click", () => {
    saveModal.style.display = "none";
});

saveModalConfirmBtn.addEventListener("click", async () => {
    if (geoRequestLock) {
        return;
    }
    if (pathModalConfirmBtn.classList.contains("incomplete")) {
        return;
    }

    geoRequestLock = true;
    saveModalConfirmBtn.innerHTML = "saving...";

    try {
        const data = {nodes, paths};
        const email = saveModalEmail.value;
        const res = await fetch("http://128.101.131.201:3000/save_nodes/" + email, {
            method: "POST",
            body: JSON.stringify(data),
            headers: {
                "Accept": "application/json",
                "Content-Type": "application/json",
            },
        });
    } catch (err) {
        console.error(err);
    }

    geoRequestLock = false;
    saveModalConfirmBtn.innerHTML = "Save";
    saveModal.style.display = "none";
    displayNodes();
});

saveModal.querySelectorAll("input").forEach(inp => inp.addEventListener("change", () => {
    for (const box of saveModal.querySelectorAll("input")) {
        if (box.value == "") {
            saveModalConfirmBtn.classList.add("incomplete");
            return;
        }
    }
    saveModalConfirmBtn.classList.remove("incomplete");
}));

// ----------------------------------- fetch modal -------------

fetchModalCloseBtn.addEventListener("click", () => {
    fetchModal.style.display = "none";
});

fetchModalConfirmBtn.addEventListener("click", async () => {
    if (geoRequestLock) {
        return;
    }
    if (pathModalConfirmBtn.classList.contains("incomplete")) {
        return;
    }

    geoRequestLock = true;
    fetchModalConfirmBtn.innerHTML = "saving...";

    try {
        const email = fetchModalEmail.value;
        const res = await fetch("http://128.101.131.201:3000/fetch_nodes/" + email);
        const json = await res.json();
        if (res.ok) {
            nodes = json.nodes;
            paths = json.paths;
        } else {
            console.log("Got no data:", json);
        }
    } catch (err) {
        console.error(err);
    }

    geoRequestLock = false;
    fetchModalConfirmBtn.innerHTML = "Fetch";
    fetchModal.style.display = "none";
    displayNodes();
});

fetchModal.querySelectorAll("input").forEach(inp => inp.addEventListener("change", () => {
    for (const box of fetchModal.querySelectorAll("input")) {
        if (box.value == "") {
            fetchModalConfirmBtn.classList.add("incomplete");
            return;
        }
    }
    fetchModalConfirmBtn.classList.remove("incomplete");
}));
