"use client";

import { useEffect, useState } from "react";
import {
  MapContainer,
  Marker,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Custom pin pakai SVG inline — gak depend pada asset image Leaflet default
// (yang sering bermasalah di Next.js webpack)
const pinIcon = L.divIcon({
  className: "rabin-pin",
  html: `<svg width="32" height="40" viewBox="0 0 32 40" xmlns="http://www.w3.org/2000/svg" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3));">
    <path d="M16 0C7.16 0 0 7.16 0 16c0 11.42 16 24 16 24s16-12.58 16-24C32 7.16 24.84 0 16 0z" fill="#f97316" stroke="#fff" stroke-width="2"/>
    <circle cx="16" cy="16" r="6" fill="#fff"/>
  </svg>`,
  iconSize: [32, 40],
  iconAnchor: [16, 40],
  popupAnchor: [0, -40],
});

function ClickHandler({
  onPick,
}: {
  onPick: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click(e) {
      onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function PanTo({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    map.flyTo([lat, lng], Math.max(map.getZoom(), 14), { duration: 0.6 });
  }, [lat, lng, map]);
  return null;
}

export default function MapPickerInner({
  initialLat,
  initialLng,
  pinLat,
  pinLng,
  onChange,
  hasInitialPin,
}: {
  initialLat: number;
  initialLng: number;
  pinLat: number;
  pinLng: number;
  hasInitialPin: boolean;
  onChange: (lat: number, lng: number) => void;
}) {
  return (
    <MapContainer
      center={[initialLat, initialLng]}
      zoom={hasInitialPin ? 14 : 5}
      style={{ height: "100%", width: "100%" }}
      scrollWheelZoom={true}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <ClickHandler onPick={onChange} />
      <Marker position={[pinLat, pinLng]} icon={pinIcon} />
      {hasInitialPin && <PanTo lat={pinLat} lng={pinLng} />}
    </MapContainer>
  );
}
