let map = document.getElementById("map");
let w = map.offsetWidth, h = map.offsetHeight;

let nodes = {}
let nextId = 0;
let selectedNode = null;
let lastNode = null;

window.onresize = () => {
    w = map.offsetWidth;
    h = map.offsetHeight;
    console.log("Updated size");
    displayNodes();
}

const startNodeBtn = document.getElementById("start-node-btn");
const pingBtn = document.getElementById("ping-btn");
const clrPingBtn = document.getElementById("clr-ping-btn");

const mapButtons = document.getElementById("map-buttons");
const mapNodes = document.getElementById("map-nodes")

mapButtons.style.display = "none";

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
    const viewWidth = map.offsetWidth;
    const viewHeight = map.offsetHeight;
    const [minLong, maxLong, minLat, maxLat] = getGeoBoundaries();

    const coordWidth = maxLat - minLat;
    const coordHeight = maxLong - minLong;

    mapNodes.innerHTML = '';

    for (const node of Object.values(nodes)) {
        const {longitude, latitude} = node;
        const nodeElement = document.createElement("div");

        const child = document.createElement("div");
        nodeElement.appendChild(child);

        const latAlpha = (latitude - minLat) / coordWidth;
        const longAlpha = (longitude - minLong) / coordHeight;

        nodeElement.style.left = String(viewWidth * latAlpha) + "px";
        nodeElement.style.bottom = String(viewHeight * longAlpha) + "px";

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

clrPingBtn.addEventListener("click", () => {
    for (const [k, node] of Object.entries(nodes)) {
        if (node.isPing) {
            delete nodes[k];
            displayNodes();
        }
    }
});

// ----------------------------------- map buttons --------------

