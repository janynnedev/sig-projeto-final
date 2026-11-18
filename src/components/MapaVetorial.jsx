"use client";

import { useEffect, useState } from "react";
import { MapContainer, TileLayer, GeoJSON, Marker, Popup, Polyline } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const iconeCruzVermelha = new L.Icon({
    iconUrl: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 32 32">
            <circle cx="16" cy="16" r="14" fill="white" stroke="#e11d48" stroke-width="2"/>
            <path d="M13 9h6v4h4v6h-4v4h-6v-4H9v-6h4V9z" fill="#e11d48"/>
        </svg>
    `),
    iconSize: [20, 20],
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

// Algoritmo Ray-Casting: Verifica se um ponto (GPS) está dentro de um Polígono (Bairro)
function verificarPontoNoPoligono(pontoLngLat, coordenadasPoligono) {
    const x = pontoLngLat[0], y = pontoLngLat[1];
    let dentro = false;
    const anelExterior = coordenadasPoligono[0]; // Pega as bordas externas da área do polígono
    
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
    const [unidadeAtiva, setUnidadeAtiva] = useState(null);

    // useEffect principal para o mapa vetorial e rastreamento GPS
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

    // useEffect que determina o centro de saúde conforme localização atual do usuário
    useEffect(() => {
        if (localizacaoUsuario && dadosAbrangencia && dadosPontos && !autoSelecionado) {
            const lng = localizacaoUsuario[1];
            const lat = localizacaoUsuario[0];

            // 1. Procura em dadosAbrangencia (onde estão os polígonos)
            const areaDoUsuario = dadosAbrangencia.features.find(f => 
                f.geometry && f.geometry.type === "Polygon" && 
                verificarPontoNoPoligono([lng, lat], f.geometry.coordinates)
            );

            if (areaDoUsuario) {
                // 2. Usa verificarAreaAtiva para achar o centro de saúde exato da área
                const centroDoUsuario = dadosPontos.features.find(f => 
                    f.geometry && f.geometry.type === "Point" && 
                    verificarAreaAtiva(areaDoUsuario.properties.name, f.properties.name)
                );

                if (centroDoUsuario) {
                    const centroLat = centroDoUsuario.geometry.coordinates[1];
                    const centroLng = centroDoUsuario.geometry.coordinates[0];

                    onSelecionarUnidade({ 
                        tipo: "centro", 
                        dados: centroDoUsuario.properties,
                        coordenadas: [centroLat, centroLng],
                        userCoords: localizacaoUsuario,
                        abrangenciaAtual: true // Ativa o aviso verde no painel de atributos
                    });
                    
                    setDestinoSelecionado([centroLat, centroLng]);
                    setUnidadeAtiva(centroDoUsuario.properties.name); // Acende a área automaticamente
                    setAutoSelecionado(true);
                }
            }
        }
    }, [localizacaoUsuario, dadosAbrangencia, dadosPontos, autoSelecionado]);

    // Configura o clique nos polígonos de abrangência
    function aoConfigurarArea(feature, layer) {
        layer.on({
            click: () => {
                // Passa as propriedades da área clicada para o painel de atributos
                onSelecionarUnidade({ tipo: "area", dados: feature.properties });
            },
        });
    }

    function verificarAreaAtiva(nomeArea, nomeUnidade) {
        if (!nomeArea || !nomeUnidade) return false;

        const areaLimpa = nomeArea.toLowerCase().trim();
        const unidadeLimpa = nomeUnidade
            .toLowerCase()
            .replace("centro de saúde ", "")
            .trim();

        return unidadeLimpa === areaLimpa;
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
                        key={unidadeAtiva || "abrangencia-padrao"}
                        data={dadosAbrangencia}
                        style={(feature) => {
                            const estaAtiva = verificarAreaAtiva(feature.properties.name, unidadeAtiva);

                            return {
                                fillColor: estaAtiva ? "#2386f7e7" : "#93c5fd",
                                color: estaAtiva ? "#0764fa" : "#3b82f6",     
                                weight: estaAtiva ? 3 : 1,                   
                                fillOpacity: estaAtiva ? 0.5 : 0.15          
                            };
                        }}
                        onEachFeature={aoConfigurarArea}
                    />
                )}

                {/* Camada 2: Marcadores das Unidades de Saúde */}
                {dadosPontos && dadosPontos.features.map((centro, index) => {
                    // GeoJSON armazena coordenadas como [longitude, latitude]
                    const lat = centro.geometry.coordinates[1];
                    const lng = centro.geometry.coordinates[0];
                    const nomeUnidade = centro.properties.name || "Unidade de Saúde";

                    return (
                        <Marker 
                            key={index} 
                            position={[lat, lng]} 
                            icon={iconeCruzVermelha}
                            eventHandlers={{
                                click: () => {
                                    onSelecionarUnidade({ 
                                        tipo: "centro", 
                                        dados: centro.properties,
                                        coordenadas: [lat, lng],
                                        userCoords: localizacaoUsuario,
                                        abrangenciaAtual: false
                                    });
                                    setDestinoSelecionado([lat, lng]);
                                    setUnidadeAtiva(nomeUnidade);
                                }
                            }}
                        >
                            <Popup>{nomeUnidade}</Popup>
                        </Marker>
                    );
                })}

                {/* Marcador GPS tempo real do Usuário */}
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