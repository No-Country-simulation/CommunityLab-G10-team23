"use client";

import React, { useState } from "react";
import { Send, CheckCircle2, AlertTriangle, ExternalLink, Newspaper, MessageSquare } from "lucide-react";
import { PublicationCard } from "@/types/backend";

interface SocialChannelBarProps {
  selectedCard: PublicationCard | null;
  onNotification: (msg: string, type: "success" | "error" | "info") => void;
  onCardApproved?: (candidatoId: string) => void;
}

export function SocialChannelBar({
  selectedCard,
  onNotification,
  onCardApproved,
}: SocialChannelBarProps) {
  const [publishingChannel, setPublishingChannel] = useState<string | null>(null);

  const handleDispatch = async (channel: "LinkedIn" | "Newsletter" | "Discord") => {
    if (!selectedCard) {
      onNotification(`Por favor selecciona un candidato antes de despachar a ${channel}`, "error");
      return;
    }

    try {
      setPublishingChannel(channel);

      // Si la tarjeta tiene un candidato_id generado por el backend, actualizamos su estado a 'aprobado' (HITL)
      if (selectedCard.candidato_id) {
        await fetch(`/api/review/assets/${selectedCard.candidato_id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            estado_aprobacion: "aprobado",
            contenido: {
              titulo: selectedCard.titulo,
              texto: selectedCard.contenido,
            },
          }),
        });

        onCardApproved?.(selectedCard.candidato_id);
      }

      onNotification(
        `[Despacho ${channel}] Candidato "${selectedCard.titulo.slice(0, 24)}..." aprobado y despachado con éxito`,
        "success"
      );
    } catch (err: any) {
      onNotification(`Error despachando a ${channel}: ${err.message}`, "error");
    } finally {
      setPublishingChannel(null);
    }
  };

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 flex flex-col gap-3.5 shadow-xs">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Publicación Directa en Canales
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {selectedCard
              ? `Envía la propuesta seleccionada ("${selectedCard.titulo.slice(0, 32)}...") directamente al canal:`
              : "Selecciona una de las tarjetas de arriba para habilitar la publicación en su canal:"}
          </p>
        </div>
        <div
          className={`text-xs font-semibold px-3 py-1 rounded-full ${
            selectedCard
              ? "bg-indigo-100 text-indigo-700 border border-indigo-200"
              : "bg-slate-200 text-slate-600"
          }`}
        >
          {selectedCard ? `Lista: ${selectedCard.titulo.slice(0, 24)}...` : "Ninguna seleccionada"}
        </div>
      </div>

      {/* Botones de Despacho Oficial */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
        {/* LinkedIn */}
        <button
          onClick={() => handleDispatch("LinkedIn")}
          disabled={publishingChannel !== null || !selectedCard}
          className="flex items-center justify-center gap-2 py-3 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-semibold shadow-xs transition disabled:opacity-40 cursor-pointer"
        >
          <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
            <path d="M19 0h-14c-2.761 0-5 2.239-5 5v14c0 2.761 2.239 5 5 5h14c2.762 0 5-2.239 5-5v-14c0-2.761-2.238-5-5-5zm-11 19h-3v-11h3v11zm-1.5-12.268c-.966 0-1.75-.79-1.75-1.764s.784-1.764 1.75-1.764 1.75.79 1.75 1.764-.783 1.764-1.75 1.764zm13.5 12.268h-3v-5.604c0-3.368-4-3.113-4 0v5.604h-3v-11h3v1.765c1.396-2.586 7-2.777 7 2.476v6.759z" />
          </svg>
          <span>Publicar en LinkedIn</span>
        </button>

        {/* Newsletter Semanal */}
        <button
          onClick={() => handleDispatch("Newsletter")}
          disabled={publishingChannel !== null || !selectedCard}
          className="flex items-center justify-center gap-2 py-3 px-3 rounded-xl bg-amber-600 hover:bg-amber-700 active:scale-95 text-white text-xs font-semibold shadow-xs transition disabled:opacity-40 cursor-pointer"
        >
          <Newspaper className="w-4 h-4" />
          <span>Enviar a Newsletter</span>
        </button>

        {/* Discord */}
        <button
          onClick={() => handleDispatch("Discord")}
          disabled={publishingChannel !== null || !selectedCard}
          className="flex items-center justify-center gap-2 py-3 px-3 rounded-xl bg-[#5865F2] hover:bg-[#4752C4] active:scale-95 text-white text-xs font-semibold shadow-xs transition disabled:opacity-40 cursor-pointer"
        >
          <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
            <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.929 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.894.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.028zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
          </svg>
          <span>Compartir en Discord</span>
        </button>
      </div>
    </div>
  );
}
