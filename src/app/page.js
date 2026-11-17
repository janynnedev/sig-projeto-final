"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import styles from "./page.module.css";

const MapaVetorial = dynamic(() => import("../components/MapaVetorial"), {
    ssr: false,
    loading: () => <p className={styles.instrucaoVazio}>Carregando sistema geográfico...</p>,
});

// Função auxiliar para o Haversine (Exercícios 04-06)
function calcularDistancia(lat1, lon1, lat2, lon2) {
    const R = 6371; // Raio da Terra em km
    const dLat = (lat2 - lat1) * (Math.PI / 180);
    const dLon = (lon2 - lon1) * (Math.PI / 180);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return (R * c).toFixed(2);
}

export default function Home() {
    const [selecao, setSelecao] = useState(null);

    return (
        <main className={styles.container}>
            <header className={styles.cabecalho}>
                <h1>Acesso à Saúde - Florianópolis</h1>
                <p>Mapeamento de Centros de Saúde e Áreas de Abrangência</p>
            </header>

            <section className={styles.mapaWrapper}>
                <MapaVetorial onSelecionarUnidade={setSelecao} />
            </section>

            <section className={styles.cardPainel}>
                <h2 className={styles.cardTitulo}>Informações da Unidade</h2>

                {selecao ? (
                    <div className={styles.listaAtributos}>
                        {selecao.tipo === "posto" && (
                            <>
                                <p className={styles.itemAtributo}>
                                    {/* Alterado para name em minúsculo */}
                                    <strong>Unidade:</strong> {selecao.dados.name || "Não informado"}
                                </p>
                                {selecao.userCoords && (
                                    <p className={styles.itemAtributo}>
                                        <strong>Distância em linha reta:</strong> {calcularDistancia(
                                            selecao.userCoords[0], selecao.userCoords[1],
                                            selecao.coordenadas[0], selecao.coordenadas[1]
                                        )} km
                                    </p>
                                )}
                            </>
                        )}
                        
                        {selecao.tipo === "area" && (
                            <p className={styles.itemAtributo}>
                                {/* Alterado para name em minúsculo */}
                                <strong>Área de Abrangência:</strong> {selecao.dados.name || "Área selecionada"}
                            </p>
                        )}
                        
                        {/* Correção para aceder a description.value */}
                        {selecao.dados.description && selecao.dados.description.value && (
                            <div 
                                style={{ marginTop: '10px', fontSize: '0.9rem', color: '#64748b' }}
                                dangerouslySetInnerHTML={{ __html: selecao.dados.description.value }} 
                            />
                        )}
                    </div>
                ) : (
                    <p className={styles.instrucaoVazio}>
                        Toque em um posto de saúde (marcador azul) ou em um bairro para ver os detalhes. Seu local é o marcador vermelho.
                    </p>
                )}
            </section>

            <footer className={styles.rodape}>
                Projeto Final SIG-Web | Janynne Palheta | Dados: Prefeitura de Florianópolis
            </footer>
        </main>
    );
}