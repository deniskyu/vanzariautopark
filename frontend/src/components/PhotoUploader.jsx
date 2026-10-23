// ============================================================================
//  src/components/PhotoUploader.jsx — încărcarea și gestionarea pozelor
// ----------------------------------------------------------------------------
//  Fluxul complet al unei poze:
//    selectezi → intră în coadă → se comprimă în browser → se urcă cu progres
//    → apare miniatura
//
//  Toate pozele alese apar IMEDIAT în grilă („În așteptare"), apoi se urcă una
//  câte una. Părintele primește în permanență câte sunt încă în lucru și câte
//  au eșuat (onStatusChange), ca să nu poată salva anunțul cu poze lipsă.
//
//  Poți urca până la 20. Poți șterge o poză, o poți reîncerca dacă a eșuat, și
//  le poți reordona: săgeți și „★ copertă" (merg și pe telefon), sau drag pe
//  desktop. Prima poză e coperta. La editare, pozele existente apar deja aici.
//
//  ── ȘTERGEREA ─────────────────────────────────────────────────────────────
//  • o poză urcată ACUM (nesalvată încă pe anunț) se șterge din B2 imediat la
//    „✕" — altfel ar rămâne orfană;
//  • o poză care face deja parte din anunțul salvat (`savedIds`) NU se șterge
//    din B2 la „✕". Dispare doar din formular; serverul o șterge abia când
//    salvezi anunțul. Înainte, „✕" + Anulează lăsa anunțul live cu poza moartă.
// ============================================================================

import { useState, useCallback, useRef, useEffect, useMemo } from 'react';
import { api } from '../api/client.js';
import { compressImage, isAcceptedImage } from '../lib/imageCompress.js';

const MAX_PHOTOS = 20;

let keySeq = 0;
const newKey = () => `n${Date.now().toString(36)}${(keySeq++).toString(36)}`;

const warn = (err) =>
    console.warn('[uploader] ștergere din B2 eșuată, va fi curățată de sweep:', err?.message);

export default function PhotoUploader({
    draftId, initial = [], savedIds = [], brokenIds = [],
    onChange, onStatusChange, apiBase = '',
}) {
    // Starea unei poze: { key, id?, ext, w, h, dir, status: 'queued'|'uploading'|'done'|'error',
    //                     progress, name, file?, error? }
    const [photos, setPhotos] = useState(() =>
        initial.map((m) => ({
            key: m.id, id: m.id, ext: m.ext, w: m.w, h: m.h, dir: m.dir || m.car_id,
            status: 'done', progress: 100,
        }))
    );
    const [error, setError] = useState('');
    const [notLoading, setNotLoading] = useState(() => new Set());   // miniaturi care nu se încarcă
    const inputRef = useRef(null);
    const dragKey = useRef(null);
    const running = useRef(false);
    const mounted = useRef(true);
    const lastEmit = useRef('');
    const lastStatus = useRef('');

    // Copie mereu actuală a listei, pentru handler-ele asincrone.
    const photosRef = useRef(photos);
    photosRef.current = photos;

    const savedSet = useMemo(() => new Set(savedIds), [savedIds]);

    useEffect(() => {
        mounted.current = true;
        return () => { mounted.current = false; };
    }, []);

    const patch = (key, changes) => {
        photosRef.current = photosRef.current.map((p) => (p.key === key ? { ...p, ...changes } : p));
        setPhotos((prev) => prev.map((p) => (p.key === key ? { ...p, ...changes } : p)));
    };

    // ── Coada de upload: o poză pe rând ─────────────────────────────────────
    const runQueue = useCallback(async () => {
        if (running.current) return;
        running.current = true;
        try {
            for (;;) {
                if (!mounted.current) break;
                const next = photosRef.current.find((p) => p.status === 'queued');
                if (!next) break;
                patch(next.key, { status: 'uploading', progress: 0, error: '' });
                try {
                    // 1. comprimă   2. urcă cu progres
                    const { blob, width, height } = await compressImage(next.file);
                    const res = await api.uploadMedia(blob, {
                        draftId, w: width, h: height,
                        onProgress: (pct) => { if (mounted.current) patch(next.key, { progress: pct }); },
                    });
                    const m = res.media;
                    // Între timp formularul s-a închis sau poza a fost scoasă → n-o mai vrea
                    // nimeni; o ștergem imediat (altfel o curăță sweep-ul peste câteva zile).
                    if (!mounted.current || !photosRef.current.some((p) => p.key === next.key)) {
                        api.deleteMedia(m.car_id, `${m.id}.${m.ext}`).catch(warn);
                        continue;
                    }
                    patch(next.key, {
                        status: 'done', progress: 100, id: m.id, ext: m.ext, w: m.w, h: m.h,
                        dir: m.car_id, file: undefined, error: '',
                    });
                } catch (err) {
                    if (mounted.current) patch(next.key, { status: 'error', error: err.message || 'Eroare la încărcare.' });
                }
            }
        } finally {
            running.current = false;
        }
    }, [draftId]);

    // După fiecare schimbare: anunțăm părintele și pornim coada dacă e cazul.
    useEffect(() => {
        const done = photos.filter((p) => p.status === 'done').map((p) => ({
            id: p.id, ext: p.ext, w: p.w, h: p.h, dir: p.dir,
        }));
        const sig = JSON.stringify(done);
        if (sig !== lastEmit.current) {
            lastEmit.current = sig;
            onChange(done);
        }
        const status = {
            pending: photos.filter((p) => p.status === 'queued' || p.status === 'uploading').length,
            failed: photos.filter((p) => p.status === 'error').length,
        };
        const statusSig = `${status.pending}/${status.failed}`;
        if (statusSig !== lastStatus.current) {
            lastStatus.current = statusSig;
            onStatusChange?.(status);
        }
        if (!running.current && photos.some((p) => p.status === 'queued')) runQueue();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [photos]);

    const urlOf = (p) => `${apiBase}/media/cars/${p.dir || draftId}/${p.id}.${p.ext || 'jpg'}`;

    const handleFiles = (fileList) => {
        setError('');
        const files = Array.from(fileList || []);
        if (inputRef.current) inputRef.current.value = '';   // poți re-selecta același fișier
        if (!files.length) return;

        const room = MAX_PHOTOS - photosRef.current.length;
        if (room <= 0) { setError(`Maxim ${MAX_PHOTOS} poze.`); return; }

        const accepted = files.filter(isAcceptedImage);
        const rejected = files.length - accepted.length;
        const toAdd = accepted.slice(0, room);

        const msgs = [];
        if (rejected) msgs.push(rejected === 1
            ? 'Un fișier nu e imagine (acceptăm JPEG, PNG, WEBP, HEIC).'
            : `${rejected} fișiere nu sunt imagini (acceptăm JPEG, PNG, WEBP, HEIC).`);
        if (accepted.length > room) msgs.push(`Doar primele ${room} poze au fost adăugate (maxim ${MAX_PHOTOS}).`);
        if (msgs.length) setError(msgs.join(' '));

        if (!toAdd.length) return;
        const items = toAdd.map((file) => ({ key: newKey(), status: 'queued', progress: 0, name: file.name, file }));
        photosRef.current = [...photosRef.current, ...items];   // o a doua selecție rapidă vede deja locurile ocupate
        setPhotos((prev) => [...prev, ...items]);
    };

    const remove = (key) => {
        const photo = photosRef.current.find((p) => p.key === key);
        if (!photo) return;
        photosRef.current = photosRef.current.filter((p) => p.key !== key);
        setPhotos((prev) => prev.filter((p) => p.key !== key));

        // Doar pozele urcate în sesiunea asta (nu cele deja salvate pe anunț).
        if (photo.status === 'done' && photo.id && !savedSet.has(photo.id)) {
            api.deleteMedia(photo.dir || draftId, `${photo.id}.${photo.ext || 'jpg'}`).catch(warn);
        }
    };

    const retry = (key) => {
        const photo = photosRef.current.find((p) => p.key === key);
        if (!photo || !photo.file) return;
        patch(key, { status: 'queued', progress: 0, error: '' });
    };

    // Mutare cu săgeți / copertă — merge pe telefon, unde drag-ul nu merge.
    const moveTo = (key, to) => {
        setPhotos((prev) => {
            const from = prev.findIndex((p) => p.key === key);
            if (from < 0) return prev;
            const target = Math.max(0, Math.min(prev.length - 1, to));
            if (from === target) return prev;
            const next = [...prev];
            const [moved] = next.splice(from, 1);
            next.splice(target, 0, moved);
            photosRef.current = next;
            return next;
        });
    };

    // Reordonare prin drag (desktop).
    const onDrop = (key) => {
        const from = dragKey.current;
        dragKey.current = null;
        if (!from || from === key) return;
        const to = photosRef.current.findIndex((p) => p.key === key);
        moveTo(from, to);
    };

    const markNotLoading = (id) => setNotLoading((prev) => {
        if (prev.has(id)) return prev;
        const next = new Set(prev);
        next.add(id);
        return next;
    });

    const doneCount = photos.filter((p) => p.status === 'done').length;
    const pending = photos.filter((p) => p.status === 'queued' || p.status === 'uploading').length;
    const failed = photos.filter((p) => p.status === 'error').length;

    return (
        <div className="uploader">
            <div className="uploader-head">
                <span className="uploader-count">{doneCount} / {MAX_PHOTOS} poze</span>
                {pending > 0 && <span className="uploader-busy">Se încarcă {pending} {pending === 1 ? 'poză' : 'poze'}…</span>}
                {failed > 0 && <span className="uploader-failed">{failed} cu eroare</span>}
                {doneCount > 1 && <span className="uploader-hint">Prima poză este coperta · folosește săgețile (sau trage) pentru a reordona</span>}
            </div>

            {error && <div className="form-error" style={{ marginBottom: '.8rem' }}>{error}</div>}

            <div className="photo-grid">
                {photos.map((p, i) => {
                    const expired = p.status === 'done' && brokenIds.includes(p.id);
                    const broken = p.status === 'done' && !expired && notLoading.has(p.id);
                    const bad = p.status === 'error' || expired || broken;
                    const isDone = p.status === 'done';
                    return (
                        <div className={`photo${bad ? ' is-error' : ''}`}
                             key={p.key}
                             draggable={isDone}
                             onDragStart={() => { dragKey.current = p.key; }}
                             onDragOver={(e) => e.preventDefault()}
                             onDrop={() => onDrop(p.key)}>

                            {expired
                                ? <div className="photo-err" title="Poza nu mai există pe server. Șterge-o și urc-o din nou.">Expirată</div>
                                : isDone
                                    ? <>
                                        <img src={urlOf(p)} alt="" loading="lazy" onError={() => markNotLoading(p.id)} />
                                        {broken && <div className="photo-err photo-err--over" title="Miniatura nu se încarcă — poza poate lipsi de pe server.">Nu se încarcă</div>}
                                      </>
                                    : p.status === 'error'
                                        ? <div className="photo-err" title={p.error}>
                                            <span>Eroare</span>
                                            <small className="photo-err-msg">{p.error}</small>
                                          </div>
                                        : p.status === 'queued'
                                            ? <div className="photo-uploading"><span className="photo-pct">În așteptare</span></div>
                                            : <div className="photo-uploading">
                                                <div className="photo-bar"><span style={{ width: p.progress + '%' }} /></div>
                                                <span className="photo-pct">{p.progress}%</span>
                                              </div>}

                            {i === 0 && isDone && !bad && <span className="photo-cover">Copertă</span>}

                            {/* ✕ mereu disponibil: și pe poze blocate în upload */}
                            <button type="button" className="photo-del"
                                    onClick={() => remove(p.key)} aria-label="Șterge poza" title="Șterge poza">✕</button>

                            {p.status === 'error' && p.file && (
                                <button type="button" className="photo-retry"
                                        onClick={() => retry(p.key)} aria-label="Reîncearcă" title="Reîncearcă">↻</button>
                            )}

                            {isDone && photos.length > 1 && (
                                <>
                                    {i > 0 && (
                                        <button type="button" className="photo-tool photo-tool--star"
                                                onClick={() => moveTo(p.key, 0)}
                                                aria-label="Fă copertă" title="Fă copertă">★</button>
                                    )}
                                    {i > 0 && (
                                        <button type="button" className="photo-tool photo-tool--left"
                                                onClick={() => moveTo(p.key, i - 1)}
                                                aria-label="Mută la stânga" title="Mută la stânga">‹</button>
                                    )}
                                    {i < photos.length - 1 && (
                                        <button type="button" className="photo-tool photo-tool--right"
                                                onClick={() => moveTo(p.key, i + 1)}
                                                aria-label="Mută la dreapta" title="Mută la dreapta">›</button>
                                    )}
                                </>
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
