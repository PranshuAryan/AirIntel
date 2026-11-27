/**
 * AppContext — shared application state consumed by every page.
 *
 * Shape of the context value:
 *   place      {label, lat, lon, cc}  — currently selected location
 *   setPlace   (place) => void        — update the selected location
 *   air        object | null          — latest air-quality reading (see apiController.js)
 *   loading    boolean                — true while the air-quality fetch is in-flight
 *   err        string                 — human-readable error message if the fetch failed
 *   std        'us' | 'in'           — active AQI standard (US EPA or India NAQI)
 *   refresh    () => void             — force a fresh air-quality fetch bypassing the cache
 *   profile    object                 — household profile (sanitized via plan.sanitizeProfile)
 *   setProfile (profile) => void      — persist an updated household profile
 */
import {createContext, useContext} from 'react';

export const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);
