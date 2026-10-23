import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import { loadLocalCities, worldClocksKey } from '../utils/worldClocks.js';

export default function useWorldClocks(userId) {
  const [state, setState] = useState({ cities: [], loading: true, ready: false, error: '' });
  const generationRef = useRef(0);
  const serverRef = useRef({ cities: [], revision: 0 });
  const desiredRef = useRef(null);
  const savingRef = useRef(false);

  const load = useCallback(async () => {
    const generation = ++generationRef.current;
    desiredRef.current = null;
    setState({ cities: [], loading: true, ready: false, error: '' });
    try {
      let result = await api.worldClocks();
      if (result.revision === 0 && result.cities.length === 0) {
        const key = worldClocksKey(userId);
        const localCities = loadLocalCities(key);
        if (localCities.length) {
          try {
            result = await api.saveWorldClocks(localCities, 0);
            localStorage.removeItem(key);
          } catch (error) {
            if (error.status !== 409) throw error;
            result = { cities: error.data.cities, revision: error.data.revision };
          }
        }
      }
      if (generation !== generationRef.current) return;
      serverRef.current = result;
      setState({ cities: result.cities, loading: false, ready: true, error: '' });
    } catch (_) {
      if (generation === generationRef.current) {
        setState({ cities: [], loading: false, ready: false, error: 'No se pudieron cargar las horas del mundo.' });
      }
    }
  }, [userId]);

  useEffect(() => {
    load();
    return () => { generationRef.current += 1; };
  }, [load]);

  const flush = useCallback(async () => {
    if (savingRef.current) return;
    savingRef.current = true;
    const generation = generationRef.current;
    try {
      while (desiredRef.current && generation === generationRef.current) {
        const cities = desiredRef.current;
        desiredRef.current = null;
        try {
          const saved = await api.saveWorldClocks(cities, serverRef.current.revision);
          if (generation !== generationRef.current) return;
          serverRef.current = saved;
          const hasPendingChange = desiredRef.current !== null;
          setState(previous => ({
            ...previous,
            cities: hasPendingChange ? previous.cities : saved.cities,
            error: '',
          }));
        } catch (error) {
          if (generation !== generationRef.current) return;
          if (error.status === 409 && Array.isArray(error.data?.cities)) {
            serverRef.current = { cities: error.data.cities, revision: error.data.revision };
            desiredRef.current = null;
            setState({ cities: error.data.cities, loading: false, ready: true, error: 'Las horas cambiaron en otra pestaña. Se han cargado los cambios recientes.' });
          } else {
            desiredRef.current = desiredRef.current || cities;
            setState(previous => ({ ...previous, error: 'No se pudieron guardar los cambios. Pulsa Reintentar.' }));
          }
          break;
        }
      }
    } finally {
      savingRef.current = false;
    }
  }, []);

  const update = useCallback(next => {
    desiredRef.current = next;
    setState(previous => ({ ...previous, cities: next, error: '' }));
    flush();
  }, [flush]);

  const retry = useCallback(() => {
    if (desiredRef.current) {
      setState(previous => ({ ...previous, error: '' }));
      flush();
    } else {
      load();
    }
  }, [flush, load]);

  return { ...state, update, retry };
}
