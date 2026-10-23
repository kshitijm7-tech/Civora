import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import type { Shelter, Rider, Assignment, AidBatch } from '../../shared/types.js';
import { 
  Building2, Bike, Home, Navigation, Layers, 
  Droplets, ShieldAlert, CheckCircle2, Maximize2 
} from 'lucide-react';

interface GpsLeafletMapProps {
  batches: AidBatch[];
  shelters: Shelter[];
  riders: Rider[];
  assignments: Assignment[];
  selectedAssignmentId?: string | null;
  onSelectAssignment?: (id: string) => void;
  onSelectShelter?: (shelterId: string) => void;
}

export const GpsLeafletMap: React.FC<GpsLeafletMapProps> = ({
  batches,
  shelters,
  riders,
  assignments,
  selectedAssignmentId,
  onSelectAssignment,
  onSelectShelter,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapInstanceRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);
  const routesLayerRef = useRef<L.LayerGroup | null>(null);
  const [mapStyle, setMapStyle] = useState<'voyager' | 'osm'>('voyager');

  // Initialize Leaflet Map once
  useEffect(() => {
    if (!mapContainerRef.current || mapInstanceRef.current) return;

    // Default center (Pune Metro area coordinates: 18.5204, 73.8567)
    const map = L.map(mapContainerRef.current, {
      center: [18.5204, 73.8567],
      zoom: 13,
      zoomControl: true,
      attributionControl: true,
    });

    const tileUrl =
      mapStyle === 'voyager'
        ? 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'
        : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

    const tileLayer = L.tileLayer(tileUrl, {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
    });
    tileLayer.addTo(map);

    const routesLayer = L.layerGroup().addTo(map);
    const markersLayer = L.layerGroup().addTo(map);

    mapInstanceRef.current = map;
    routesLayerRef.current = routesLayer;
    markersLayerRef.current = markersLayer;

    return () => {
      map.remove();
      mapInstanceRef.current = null;
    };
  }, []);

  // Update tile layer if style changes
  useEffect(() => {
    if (!mapInstanceRef.current) return;
    const tileUrl =
      mapStyle === 'voyager'
        ? 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png'
        : 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';

    // remove previous tile layers
    mapInstanceRef.current.eachLayer(layer => {
      if (layer instanceof L.TileLayer) {
        mapInstanceRef.current?.removeLayer(layer);
      }
    });

    L.tileLayer(tileUrl, {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors &copy; CARTO',
    }).addTo(mapInstanceRef.current);
  }, [mapStyle]);

  // Update Markers & Polylines when entities change
  useEffect(() => {
    const map = mapInstanceRef.current;
    const markersLayer = markersLayerRef.current;
    const routesLayer = routesLayerRef.current;
    if (!map || !markersLayer || !routesLayer) return;

    markersLayer.clearLayers();
    routesLayer.clearLayers();

    const latLngBounds: L.LatLngExpression[] = [];

    // Helper to get fallback lat/lng if not explicitly defined
    const getCoords = (loc: { lat?: number; lng?: number; x: number; y: number }): [number, number] => {
      if (loc.lat && loc.lng) return [loc.lat, loc.lng];
      // Fallback projection mapping from x,y [0-100] to Pune Metro bounds
      const baseLat = 18.5204 + (50 - loc.y) * 0.0018;
      const baseLng = 73.8567 + (loc.x - 50) * 0.0022;
      return [baseLat, baseLng];
    };

    // 1. Add Donor Markers
    batches.forEach(b => {
      const coords = getCoords(b.origin);
      latLngBounds.push(coords);

      const iconHtml = `
        <div style="background-color: #1e1b4b; color: white; border: 2px solid white; border-radius: 8px; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 6px rgba(0,0,0,0.3); font-weight: bold; font-size: 11px;">
          🏢
        </div>
      `;

      const customIcon = L.divIcon({
        html: iconHtml,
        className: 'civora-donor-pin',
        iconSize: [34, 34],
        iconAnchor: [17, 17],
        popupAnchor: [0, -18],
      });

      const marker = L.marker(coords, { icon: customIcon });
      marker.bindPopup(`
        <div style="font-family: sans-serif; font-size: 12px; line-height: 1.4;">
          <strong style="color: #102a43; font-size: 13px;">${b.donorName}</strong><br/>
          <span style="color: #64748b; font-size: 11px;">Donor Origin (${b.id})</span><br/>
          <div style="margin-top: 4px; padding: 4px 6px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px;">
            <strong>Category:</strong> ${b.category.replace('_', ' ')}<br/>
            <strong>Total:</strong> ${b.totalQuantity} ${b.unit}<br/>
            <strong>Status:</strong> ${b.status}
          </div>
        </div>
      `);
      markersLayer.addLayer(marker);
    });

    // 2. Add Shelter Markers
    shelters.forEach(s => {
      const coords = getCoords(s.location);
      latLngBounds.push(coords);
      const isClosed = !s.active;
      const hasCleanWater = s.resources.includes('CLEAN_WATER');

      const bgColor = isClosed ? '#64748b' : s.priority === 'CRITICAL' ? '#0f766e' : '#14b8a6';
      const iconHtml = `
        <div style="background-color: ${bgColor}; color: white; border: 2px solid white; border-radius: 8px; width: 36px; height: 36px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 6px rgba(0,0,0,0.3); font-weight: bold; position: relative;">
          🏥
          ${hasCleanWater ? '<span style="position: absolute; top: -4px; right: -4px; background: #0284c7; color: white; border-radius: 50%; width: 14px; height: 14px; font-size: 9px; display: flex; align-items: center; justify-content: center; border: 1px solid white;">💧</span>' : '<span style="position: absolute; top: -4px; right: -4px; background: #ef4444; color: white; border-radius: 50%; width: 14px; height: 14px; font-size: 9px; display: flex; align-items: center; justify-content: center; border: 1px solid white;">!</span>'}
        </div>
      `;

      const customIcon = L.divIcon({
        html: iconHtml,
        className: 'civora-shelter-pin',
        iconSize: [36, 36],
        iconAnchor: [18, 18],
        popupAnchor: [0, -20],
      });

      const marker = L.marker(coords, { icon: customIcon });
      marker.bindPopup(`
        <div style="font-family: sans-serif; font-size: 12px; line-height: 1.4; min-width: 180px;">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 4px;">
            <strong style="color: #102a43; font-size: 13px;">${s.name}</strong>
            <span style="font-size: 10px; font-weight: bold; padding: 1px 4px; border-radius: 3px; background: ${isClosed ? '#fee2e2; color: #991b1b' : '#dcfce7; color: #166534'}">${isClosed ? 'CLOSED' : 'ACTIVE'}</span>
          </div>
          <span style="color: #64748b; font-size: 11px;">${s.location.address}</span>
          <div style="margin-top: 6px; padding: 6px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px;">
            <strong>Water Access:</strong> ${hasCleanWater ? '✅ Verified Clean Water' : '❌ No Clean Water'}<br/>
            <strong>Occupancy:</strong> ${s.currentOccupancy} / ${s.capacityLimit}<br/>
            <strong>Cooked Meals Demand:</strong> ${s.demandByCategory['COOKED_MEALS'] || 0}
          </div>
        </div>
      `);
      marker.on('click', () => {
        onSelectShelter?.(s.id);
      });
      markersLayer.addLayer(marker);
    });

    // 3. Add Rider Markers
    riders.forEach(r => {
      const coords = getCoords(r.location);
      latLngBounds.push(coords);

      const isBusy = r.status === 'IN_TRANSIT' || r.status === 'RESERVED';
      const bgColor = isBusy ? '#f59e0b' : r.available ? '#102a43' : '#94a3b8';

      const iconHtml = `
        <div style="background-color: ${bgColor}; color: white; border: 2px solid white; border-radius: 50%; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; box-shadow: 0 3px 5px rgba(0,0,0,0.3); font-size: 12px;">
          ${r.vehicleType === 'VAN' ? '🚐' : '🚴'}
        </div>
      `;

      const customIcon = L.divIcon({
        html: iconHtml,
        className: 'civora-rider-pin',
        iconSize: [30, 30],
        iconAnchor: [15, 15],
        popupAnchor: [0, -16],
      });

      const marker = L.marker(coords, { icon: customIcon });
      marker.bindPopup(`
        <div style="font-family: sans-serif; font-size: 12px; line-height: 1.4;">
          <strong style="color: #102a43; font-size: 13px;">${r.name}</strong><br/>
          <span style="color: #64748b; font-size: 11px;">Volunteer Rider (${r.vehicleType})</span><br/>
          <div style="margin-top: 4px; padding: 4px 6px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 4px;">
            <strong>Capacity:</strong> ${r.currentLoad} / ${r.capacity} units<br/>
            <strong>Status:</strong> ${r.status}<br/>
            <strong>Equipment:</strong> ${r.capabilities.join(', ')}
          </div>
        </div>
      `);
      markersLayer.addLayer(marker);
    });

    // 4. Add Active Shipment Route Corridors (Polylines)
    assignments.forEach(assign => {
      if (assign.status === 'DELIVERED' || assign.status === 'EXPIRED' || assign.status === 'CANCELLED') return;

      const fromCoords = getCoords(assign.origin);
      const toCoords = getCoords(assign.destination);
      const isSelected = assign.id === selectedAssignmentId;
      const isIntervention = assign.status === 'INTERVENTION_REQUIRED';
      const isInTransit = assign.status === 'IN_TRANSIT' || assign.status === 'PICKED_UP';

      const strokeColor = isIntervention ? '#dc2626' : isInTransit ? '#f59e0b' : '#0284c7';

      const polyline = L.polyline([fromCoords, toCoords], {
        color: strokeColor,
        weight: isSelected ? 5 : 3.5,
        opacity: 0.85,
        dashArray: isInTransit ? '8, 6' : undefined,
      });

      polyline.bindTooltip(`
        <strong>${assign.id}</strong>: ${assign.quantity} ${assign.unit} (${assign.category.replace('_', ' ')})<br/>
        Rider: ${assign.riderName} &rarr; ${assign.shelterName}<br/>
        Status: ${assign.status}
      `, { sticky: true });

      polyline.on('click', () => {
        onSelectAssignment?.(assign.id);
      });

      routesLayer.addLayer(polyline);
    });

    // Fit bounds if we have valid points
    if (latLngBounds.length > 0) {
      try {
        const bounds = L.latLngBounds(latLngBounds);
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
      } catch {
        // ignore bounds calculation errors
      }
    }
  }, [batches, shelters, riders, assignments, selectedAssignmentId]);

  const fitBoundsHandler = () => {
    if (!mapInstanceRef.current) return;
    const allCoords: [number, number][] = [];
    batches.forEach(b => {
      if (b.origin.lat && b.origin.lng) allCoords.push([b.origin.lat, b.origin.lng]);
    });
    shelters.forEach(s => {
      if (s.location.lat && s.location.lng) allCoords.push([s.location.lat, s.location.lng]);
    });
    riders.forEach(r => {
      if (r.location.lat && r.location.lng) allCoords.push([r.location.lat, r.location.lng]);
    });

    if (allCoords.length > 0) {
      mapInstanceRef.current.fitBounds(L.latLngBounds(allCoords), { padding: [50, 50], maxZoom: 14 });
    }
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-xs space-y-3">
      {/* Top Map Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
            <Navigation className="w-4 h-4 text-teal-700" />
            Civora Live Leaflet GPS Map
          </span>
          <span className="text-[11px] bg-teal-50 text-teal-800 border border-teal-200 px-2 py-0.5 rounded font-mono font-bold">
            Real GPS Coordinates
          </span>
        </div>

        <div className="flex items-center gap-2 text-xs">
          <div className="flex items-center bg-slate-100 p-0.5 rounded-md border border-slate-200">
            <button
              onClick={() => setMapStyle('voyager')}
              className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors ${
                mapStyle === 'voyager' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
              }`}
            >
              Voyager Light
            </button>
            <button
              onClick={() => setMapStyle('osm')}
              className={`px-2 py-1 rounded text-[11px] font-semibold transition-colors ${
                mapStyle === 'osm' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'
              }`}
            >
              OpenStreetMap
            </button>
          </div>

          <button
            onClick={fitBoundsHandler}
            className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md border border-slate-200 transition-colors"
            title="Fit Bounds to all Entities"
          >
            <Maximize2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Leaflet Map Div */}
      <div className="relative w-full h-[400px] rounded-lg border border-slate-200 overflow-hidden shadow-inner">
        <div ref={mapContainerRef} className="w-full h-full z-10" />

        {/* Legend Overlay */}
        <div className="absolute bottom-3 left-3 z-[400] bg-white/95 backdrop-blur-xs p-2.5 rounded-lg border border-slate-200 shadow-md text-[11px] space-y-1.5 pointer-events-auto">
          <div className="font-bold text-slate-800 text-[10px] uppercase tracking-wider">
            Map Legend
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 rounded bg-indigo-950 flex items-center justify-center text-[8px] text-white">🏢</span>
            <span className="text-slate-700">Donor Facility</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 rounded bg-teal-600 flex items-center justify-center text-[8px] text-white">🏥</span>
            <span className="text-slate-700">Receiving Shelter</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3.5 h-3.5 rounded-full bg-slate-900 flex items-center justify-center text-[8px] text-white">🚴</span>
            <span className="text-slate-700">Volunteer Rider</span>
          </div>
          <div className="pt-1 border-t border-slate-100 flex items-center gap-3">
            <span className="flex items-center gap-1 text-amber-600 font-medium">
              <span className="w-3 h-0.5 bg-amber-500 inline-block" /> In Transit
            </span>
            <span className="flex items-center gap-1 text-red-600 font-medium">
              <span className="w-3 h-0.5 bg-red-600 inline-block" /> Intervention
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
