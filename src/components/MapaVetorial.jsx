"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, GeoJSON, Marker, Popup, Polyline } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const iconeCruzVermelha = new L.Icon({
    iconUrl: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 32 32">
            <circle cx="16" cy="16" r="14" fill="white" stroke="#e11d48" stroke-width="2"/>
            <path d="M13 9h6v4h4v6h-4v4h-6v-4H9v-6h4V9z" fill="#e11d48"/>
        </svg>
    `),
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
    shadowUrl: null 
});

const iconeUsuario = new L.Icon({
    iconUrl: "https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-red.png",
    shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png",
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
});

// Coordenadas centrais de Florianópolis
const CENTRO_FLORIPA = [-27.5954, -48.5480];

const ESTILO_ABRANGENCIA = {
    fillColor: "#3b83f6cb", 
    color: "#1d4ed8",
    weight: 2,
    fillOpacity: 0.3
};

// Algoritmo Ray-Casting: Verifica se um ponto (GPS) está dentro de um Polígono (Bairro)
function verificarPontoNoPoligono(pontoLngLat, coordenadasPoligono) {
    const x = pontoLngLat[0], y = pontoLngLat[1];
    let dentro = false;
    const anelExterior = coordenadasPoligono[0]; // Pega as bordas externas da área
    
    for (let i = 0, j = anelExterior.length - 1; i < anelExterior.length; j = i++) {
        const xi = anelExterior[i][0], yi = anelExterior[i][1];
        const xj = anelExterior[j][0], yj = anelExterior[j][1];
        
        const cruzouMargem = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (cruzouMargem) dentro = !dentro;
    }
    return dentro;
}

export default function MapaVetorial({ onSelecionarUnidade }) {
    const [dadosAbrangencia, setDadosAbrangencia] = useState(null);
    const [dadosPontos, setDadosPontos] = useState(null);
    const [localizacaoUsuario, setLocalizacaoUsuario] = useState(null);
    const [destinoSelecionado, setDestinoSelecionado] = useState(null);
    const [carregando, setCarregando] = useState(true);
    const [autoSelecionado, setAutoSelecionado] = useState(false);

    useEffect(() => {
        Promise.all([
            fetch("/abrangencia-csaude.geojson").then(res => res.json()),
            fetch("/pontos-csaude.geojson").then(res => res.json())
        ])
        .then(([abrangencia, pontos]) => {
            setDadosAbrangencia(abrangencia);
            setDadosPontos(pontos);
        })
        .catch(erro => console.error("Erro ao carregar dados geográficos:", erro))
        .finally(() => setCarregando(false));

        // Inicia o rastreamento GPS do usuário
        const gpsId = navigator.geolocation.watchPosition(
            (posicao) => {
                setLocalizacaoUsuario([posicao.coords.latitude, posicao.coords.longitude]);
            },
            (erro) => console.error("Erro de GPS:", erro),
            { enableHighAccuracy: true }
        );

        // Limpa o GPS ao desmontar o componente
        return () => navigator.geolocation.clearWatch(gpsId);
    }, []);

    useEffect(() => {
        if (localizacaoUsuario && dadosPontos && !autoSelecionado) {
            const lng = localizacaoUsuario[1];
            const lat = localizacaoUsuario[0];

            // Descobre em qual polígono (área de saúde) o usuário está
            const areaDoUsuario = dadosPontos.features.find(f => 
                f.geometry && f.geometry.type === "Polygon" && 
                verificarPontoNoPoligono([lng, lat], f.geometry.coordinates)
            );

            if (areaDoUsuario) {
                // Acha o posto com o mesmo nome da área
                const nomeDaArea = areaDoUsuario.properties.name.toLowerCase();
                const postoDoUsuario = dadosPontos.features.find(f => 
                    f.geometry && f.geometry.type === "Point" && 
                    f.properties.name && f.properties.name.toLowerCase().includes(nomeDaArea)
                );

                if (postoDoUsuario) {
                    const postoLat = postoDoUsuario.geometry.coordinates[1];
                    const postoLng = postoDoUsuario.geometry.coordinates[0];

                    onSelecionarUnidade({
                        tipo: "posto",
                        dados: postoDoUsuario.properties,
                        coordenadas: [postoLat, postoLng],
                        userCoords: localizacaoUsuario,
                        abrangenciaAtual: true 
                    });
                    
                    setDestinoSelecionado([postoLat, postoLng]); 
                    setAutoSelecionado(true); 
                }
            }
        }
    }, [localizacaoUsuario, dadosPontos, autoSelecionado]);

    // Configura o clique nos polígonos de abrangência
    function aoConfigurarArea(feature, layer) {
        layer.on({
            click: () => {
                // Passa as propriedades da área clicada para o painel principal
                onSelecionarUnidade({ tipo: "area", dados: feature.properties });
            },
        });
    }

    return (
        <div style={{ position: "relative", width: "100%", height: "60vh", borderRadius: "12px", overflow: "hidden", border: "1px solid #334155" }}>
            {carregando && (
                <div style={{ position: "absolute", top: 12, left: 56, zIndex: 1000, background: "rgba(15, 23, 42, 0.85)", color: "#10b981", padding: "6px 12px", borderRadius: 6, fontSize: 12 }}>
                    Carregando mapa de saúde...
                </div>
            )}

            <MapContainer center={CENTRO_FLORIPA} zoom={11} style={{ height: "100%", width: "100%" }}>
                <TileLayer
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    attribution="&copy; OpenStreetMap"
                    maxZoom={19}
                />

                {/* Camada 1: Polígonos de Abrangência */}
                {dadosAbrangencia && (
                    <GeoJSON
                        data={dadosAbrangencia}
                        style={ESTILO_ABRANGENCIA}
                        onEachFeature={aoConfigurarArea}
                    />
                )}

                {/* Camada 2: Marcadores das Unidades de Saúde */}
                {dadosPontos && dadosPontos.features.map((posto, index) => {
                    // GeoJSON armazena coordenadas como [longitude, latitude]
                    const lat = posto.geometry.coordinates[1];
                    const lng = posto.geometry.coordinates[0];
                    const nomeUnidade = posto.properties.name || "Unidade de Saúde";

                    return (
                        <Marker 
                            key={index} 
                            position={[lat, lng]} 
                            icon={iconeCruzVermelha}
                            eventHandlers={{
                                click: () => {
                                    // Adiciona as coordenadas para futuro cálculo de Haversine
                                    onSelecionarUnidade({ 
                                        tipo: "posto", 
                                        dados: posto.properties,
                                        coordenadas: [lat, lng],
                                        userCoords: localizacaoUsuario
                                    });
                                    setDestinoSelecionado([lat, lng]);
                                }
                            }}
                        >
                            <Popup>{nomeUnidade}</Popup>
                        </Marker>
                    );
                })}

                {/* Marcador em tempo real do Usuário */}
                {localizacaoUsuario && (
                    <Marker position={localizacaoUsuario} icon={iconeUsuario}>
                        <Popup>Sua localização atual</Popup>
                    </Marker>
                )}

                {localizacaoUsuario && destinoSelecionado && (
                    <Polyline 
                        positions={[localizacaoUsuario, destinoSelecionado]} 
                        pathOptions={{ 
                            color: '#e11d48', 
                            dashArray: '8, 8', 
                            weight: 3,
                            opacity: 0.8
                        }} 
                    />
                )}
            </MapContainer>
        </div>
    );
}