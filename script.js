const mapElement = document.getElementById('map');
const activityNameElement = document.getElementById('activityName');
const activityDetailsElement = document.getElementById('activityDetails');
const toggleBtn = document.getElementById('toggleTrackingBtn');
const statusOverlay = document.getElementById('statusOverlay');

let map;
let polyline;
let isTracking = false;
let path = [];
let watchId = null;
let totalDistance = 0;

navigator.geolocation.getCurrentPosition(
    (position) => {
        const { latitude, longitude } = position.coords;
        initializeMap(latitude, longitude);
    },
    (error) => {
        console.error("Erro ao obter localização: ", error);
        initializeMap(-8.0631, -34.8711);
    }
);

function initializeMap(lat, lon) {
    map = L.map(mapElement).setView([lat, lon], 16);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    }).addTo(map);
    L.marker([lat, lon]).addTo(map).bindPopup('Você está aqui!').openPopup();
}

// --- Função para calcular a distância entre dois pontos (Haversine) ---
function haversineDistance(coords1, coords2) {
    function toRad(x) {
        return x * Math.PI / 180;
    }

    const lon1 = coords1[1];
    const lat1 = coords1[0];

    const lon2 = coords2[1];
    const lat2 = coords2[0];

    const R = 6371; // Raio da Terra em km

    const dLat = toRad(lat2 - lat1);
    const dLon = toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c;

    return d * 1000; // retorna a distância em metros
}

// --- Funções de Controle ---
async function startTracking() {
    path = [];
    totalDistance = 0; // Reseta a distância
    activityNameElement.textContent = "Iniciando...";
    activityDetailsElement.textContent = "Distância: 0m";
    statusOverlay.style.display = 'block'; // Mostra o status "Gravando"
    if (polyline) {
        map.removeLayer(polyline);
    }

    isTracking = true;
    toggleBtn.innerHTML = '<span class="material-symbols-outlined icon">stop</span><span class="text">Parar</span>';
    toggleBtn.className = "stop";

    watchId = navigator.geolocation.watchPosition(
        (position) => {
            const { latitude, longitude } = position.coords;
            const newCoord = [latitude, longitude];

            if (path.length > 0) {
                const lastCoord = path[path.length - 1];
                totalDistance += haversineDistance(lastCoord, newCoord);
                activityDetailsElement.textContent = `Distância: ${totalDistance.toFixed(0)}m`;
            }

            path.push(newCoord);
            
            if (polyline) {
                polyline.setLatLngs(path);
            } else {
                polyline = L.polyline(path, { color: 'red' }).addTo(map);
            }
            map.panTo(newCoord);
            activityNameElement.textContent = "Gravando sua rota...";
        },
        (error) => {
            console.error("Erro no rastreamento: ", error);
        },
        { enableHighAccuracy: true }
    );
}

async function stopTracking() {
    isTracking = false;
    toggleBtn.innerHTML = '<span class="material-symbols-outlined icon">play_arrow</span><span class="text">Iniciar</span>';
    toggleBtn.className = "start";
    statusOverlay.style.display = 'none';

    if (watchId) {
        navigator.geolocation.clearWatch(watchId);
    }

    if (path.length > 1) {
        const finalLocation = path[path.length - 1];
        L.marker(finalLocation).addTo(map).bindPopup('Fim da atividade.').openPopup();
        
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${finalLocation[0]}&lon=${finalLocation[1]}`);
        const data = await response.json();
        
        const street = data.address.road || data.address.suburb || 'local desconhecido';
        activityNameElement.textContent = `Atividade finalizada em: ${street}`;
        // MODIFICADO: altera a distância final para km se for maior que 1000m
        if (totalDistance > 1000) {
            activityDetailsElement.textContent = `Distância total: ${(totalDistance / 1000).toFixed(2)}km`;
        } else {
            activityDetailsElement.textContent = `Distância total: ${totalDistance.toFixed(0)}m`;
        }

    } else {
        activityNameElement.textContent = "Nenhum trajeto foi gravado.";
    }
}

toggleBtn.addEventListener('click', () => {
    if (isTracking) {
        stopTracking();
    } else {
        startTracking();
    }
});