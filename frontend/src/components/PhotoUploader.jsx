// ============================================================================
//  src/components/PhotoUploader.jsx — încărcarea și gestionarea pozelor
// ----------------------------------------------------------------------------
//  Fluxul complet al unei poze:
//    selectezi → se comprimă în browser → se urcă cu progres → apare miniatura
//
//  Poți urca până la 20. Fiecare arată propriul progres. Poți șterge o poză sau
//  reordona (prima e coperta). La editare, pozele existente apar deja aici.
//
//  Starea unei poze: { id, ext, w, h, url?, status: 'uploading'|'done'|'error',
//                      progress, name }
// ============================================================================

import { useState, useCallback, useRef } from 'react';
import { api } from '../api/client.js';
import { compressImage, isAcceptedImage, formatBytes } from '../lib/imageCompress.js';

const MAX_PHOTOS = 20;

export default function PhotoUploader({ draftId, initial = [], onChange, apiBase = '' }) {
    // Pozele deja urcate (din editare) vin ca { id, ext, w, h }.
    const [photos, setPhotos] = useState(() =>
        initial.map((m) => ({ ...m, dir: m.dir || m.car_id, status: 'done', progress: 100 }))
    );
    const [error, setError] = useState('');
    const inputRef = useRef(null);
    const dragIndex = useRef(null);

    // Anunță formularul-părinte lista curentă (doar pozele gata, în ordine).
    const emit = useCallback((list) => {
        onChange(list.filter((p) => p.status === 'done').map((p) => ({
            id: p.id, ext: p.ext, w: p.w, h: p.h, dir: p.dir || p.car_id,
        })));
    }, [onChange]);

    const urlOf = (p) => p.url || `${apiBase}/media/cars/${p.dir || p.car_id || draftId}/${p.id}.${p.ext || 'jpg'}`;

    const handleFiles = async (fileList) => {
        setError('');
        const files = Array.from(fileList);
        const room = MAX_PHOTOS - photos.length;
        if (room <= 0) { setError(`Maxim ${MAX_PHOTOS} poze.`); return; }
        const toAdd = files.slice(0, room);
        if (files.length > room) setError(`Doar primele ${room} poze au fost adăugate (maxim ${MAX_PHOTOS}).`);

        for (const file of toAdd) {
            if (!isAcceptedImage(file)) {
                setError('Doar imagini JPEG, PNG sau WEBP.');
                continue;
            }
            // marcaj temporar cu id local, ca să afișăm progresul
            const tmpId = 'tmp_' + Math.random().toString(36).slice(2);
            const placeholder = { tmpId, status: 'uploading', progress: 0, name: file.name };
            setPhotos((prev) => { const next = [...prev, placeholder]; return next; });

            try {
                // 1. comprimă
                const { blob, width, height } = await compressImage(file);
                // 2. urcă cu progres
                const res = await api.uploadMedia(blob, {
                    draftId, w: width, h: height,
                    onProgress: (pct) => {
                        setPhotos((prev) => prev.map((p) =>
                            p.tmpId === tmpId ? { ...p, progress: pct } : p));
                    },
                });
                // 3. înlocuiește placeholder-ul cu poza reală
                setPhotos((prev) => {
                    const next = prev.map((p) =>
                        p.tmpId === tmpId
                            ? { id: res.media.id, ext: res.media.ext, w: res.media.w, h: res.media.h,
                                dir: res.media.car_id, car_id: res.media.car_id, status: 'done', progress: 100 }
                            : p);
                    emit(next);
                    return next;
                });
            } catch (err) {
                setPhotos((prev) => prev.map((p) =>
                    p.tmpId === tmpId ? { ...p, status: 'error', error: err.message } : p));
            }
        }
        // reset input ca să poți re-selecta același fișier
        if (inputRef.current) inputRef.current.value = '';
    };

    const remove = (target) => {
        setPhotos((prev) => {
            const next = prev.filter((p) => (p.id || p.tmpId) !== target);
            emit(next);
            return next;
        });
    };

    // Reordonare prin drag (desktop). Prima poză = coperta.
    const onDragStart = (i) => { dragIndex.current = i; };
    const onDrop = (i) => {
        const from = dragIndex.current;
        if (from === null || from === i) return;
        setPhotos((prev) => {
            const next = [...prev];
            const [moved] = next.splice(from, 1);
            next.splice(i, 0, moved);
            emit(next);
            return next;
        });
        dragIndex.current = null;
    };

    const doneCount = photos.filter((p) => p.status === 'done').length;

    return (
        <div className="uploader">
            <div className="uploader-head">
                <span className="uploader-count">{doneCount} / {MAX_PHOTOS} poze</span>
                {doneCount > 0 && <span className="uploader-hint">Prima poză este coperta · trage pentru a reordona</span>}
            </div>

            {error && <div className="form-error" style={{ marginBottom: '.8rem' }}>{error}</div>}

            <div className="photo-grid">
                {photos.map((p, i) => {
                    const key = p.id || p.tmpId;
                    return (
                        <div className={`photo${p.status === 'error' ? ' is-error' : ''}`}
                             key={key}
                             draggable={p.status === 'done'}
                             onDragStart={() => onDragStart(i)}
                             onDragOver={(e) => e.preventDefault()}
                             onDrop={() => onDrop(i)}>
                            {p.status === 'done'
                                ? <img src={urlOf(p)} alt="" loading="lazy" />
                                : p.status === 'error'
                                    ? <div className="photo-err" title={p.error}>Eroare</div>
                                    : <div className="photo-uploading">
                                        <div className="photo-bar"><span style={{ width: p.progress + '%' }} /></div>
                                        <span className="photo-pct">{p.progress}%</span>
                                      </div>}

                            {i === 0 && p.status === 'done' && <span className="photo-cover">Copertă</span>}
                            {p.status !== 'uploading' && (
                                <button type="button" className="photo-del"
                                        onClick={() => remove(key)} aria-label="Șterge poza">✕</button>
                            )}
                        </div>
                    );
                })}

                {photos.length < MAX_PHOTOS && (
                    <button type="button" className="photo-add" onClick={() => inputRef.current?.click()}>
                        <span className="photo-add-plus">+</span>
                        <span>Adaugă poze</span>
                    </button>
                )}
            </div>

            <input ref={inputRef} type="file" accept="image/jpeg,image/png,image/webp"
                   multiple hidden
                   onChange={(e) => handleFiles(e.target.files)} />
        </div>
    );
}
