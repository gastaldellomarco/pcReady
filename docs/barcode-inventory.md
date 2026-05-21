# Barcode 1D inventario

Il flusso barcode 1D serve solo per compilare rapidamente campi brevi e lineari:

- `asset_tag`: identificativo interno scansionabile dell'asset.
- `serial`: seriale produttore, mantenuto separato dall'asset tag.

Questo flusso e' distinto dal QR code inventario. I QR restano dedicati a etichette, URL e apertura della scheda asset.

## Scanner hardware

Gli scanner USB/Bluetooth in modalita' keyboard-wedge scrivono nel campo attivo come una tastiera.
Nel form dispositivo i pulsanti `USB` portano rapidamente il focus su `asset_tag` o `serial`.
Se lo scanner invia `Enter` a fine lettura, il campo conferma il valore senza salvare automaticamente l'intero dispositivo.

## Scanner camera

Il pulsante con icona barcode apre la lettura camera per barcode lineari 1D usando ZXing.
I formati attesi sono:

- Code 128
- Code 39
- Code 93
- Codabar
- ITF
- EAN-13
- EAN-8
- UPC-A
- UPC-E

Se la camera non e' disponibile o il browser non consente i permessi, il dialog mostra un messaggio e mantiene il campo manuale compatibile con scanner hardware.

## Regola asset

Non usare il seriale produttore come identificativo primario dell'asset. L'asset tag interno resta il codice operativo principale; il seriale rimane un dato separato per garanzia, assistenza e riconciliazione.
