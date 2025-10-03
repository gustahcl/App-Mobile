import React, { useState, useEffect, useRef } from 'react';
import { StyleSheet, View, Text, Button, Alert, Platform } from 'react-native';
import MapView, { Polyline, Marker } from 'react-native-maps';
import * as Location from 'expo-location';

// Interface para o TypeScript saber o formato de uma coordenada
interface Coordinate {
  latitude: number;
  longitude: number;
}

export default function DiarioAtivoScreen() {
  const [isTracking, setIsTracking] = useState(false);
  const [path, setPath] = useState<Coordinate[]>([]);
  const [activityName, setActivityName] = useState<string | null>(null);
  const [currentLocation, setCurrentLocation] = useState<Coordinate | null>(null);

  const mapRef = useRef<MapView>(null);
  const locationSubscription = useRef<Location.LocationSubscription | null>(null);

  // --- Permissão do GPS ---
  useEffect(() => {
    (async () => {
      let { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permissão Negada', 'Este app precisa da permissão de localização para funcionar.');
        return;
      }
      // Pega a localização inicial para centralizar o mapa
      let location = await Location.getCurrentPositionAsync({});
      setCurrentLocation(location.coords);
    })();
  }, []);

  // --- Funções de Controle ---
  const startTracking = async () => {
    // Limpa os dados da atividade anterior
    setPath([]);
    setActivityName(null);
    setIsTracking(true);

    // Começa a "ouvir" as atualizações de localização do GPS
    locationSubscription.current = await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.High,
        distanceInterval: 10, // Atualiza a cada 10 metros
      },
      (location) => {
        const newCoordinate = {
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        };
        setPath((currentPath) => [...currentPath, newCoordinate]);
        setCurrentLocation(newCoordinate);
      }
    );
  };

  const stopTracking = async () => {
    setIsTracking(false);
    // Para de "ouvir" o GPS
    if (locationSubscription.current) {
      locationSubscription.current.remove();
    }

    if (path.length > 0) {
      // Pega a última coordenada do trajeto
      const finalLocation = path[path.length - 1];
      // Usa a API de Geocodificação Reversa para encontrar o endereço
      const address = await Location.reverseGeocodeAsync(finalLocation);

      if (address.length > 0) {
        const { street, subregion } = address[0];
        const name = street ? `Caminhada em ${street}` : `Atividade em ${subregion || 'local desconhecido'}`;
        setActivityName(name);
      }
    }
  };

  // Centraliza o mapa na localização do usuário
  useEffect(() => {
    if (currentLocation && mapRef.current) {
      mapRef.current.animateToRegion({
        ...currentLocation,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      });
    }
  }, [currentLocation]);


  // --- Interface do Usuário ---
  return (
    <View style={styles.container}>
      {currentLocation ? (
        <MapView
          ref={mapRef}
          style={styles.map}
          initialRegion={{
            ...currentLocation,
            latitudeDelta: 0.01,
            longitudeDelta: 0.01,
          }}
          showsUserLocation={true}
        >
          {/* Desenha a linha do trajeto no mapa */}
          <Polyline coordinates={path} strokeColor="#FF0000" strokeWidth={5} />

          {/* Mostra um marcador no final do trajeto */}
          {path.length > 1 && !isTracking && (
            <Marker coordinate={path[path.length - 1]} title="Fim da Atividade" />
          )}
        </MapView>
      ) : (
        <Text>Obtendo localização...</Text> // Mensagem de carregamento
      )}

      <View style={styles.buttonContainer}>
        {activityName && <Text style={styles.activityName}>{activityName}</Text>}
        <Button
          title={isTracking ? "Parar Caminhada" : "Iniciar Caminhada"}
          onPress={isTracking ? stopTracking : startTracking}
          color={isTracking ? "#c0392b" : "#27ae60"}
        />
      </View>
    </View>
  );
}

// --- Estilos ---
const styles = StyleSheet.create({
  container: { flex: 1 },
  map: { ...StyleSheet.absoluteFillObject },
  buttonContainer: {
    position: 'absolute',
    bottom: 50,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 15,
    padding: 15,
    alignItems: 'center',
  },
  activityName: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
});