export default function handler(req, res) {
  const cp    = String(req.query.cp ?? '').replace(/[^0-9]/g, '').slice(0, 5);
  const brand = String(req.query.brand ?? 'BDTEST13').replace(/[^A-Z0-9]/gi, '').slice(0, 20) || 'BDTEST13';

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.status(200).send(`<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="stylesheet" href="https://widget.mondialrelay.com/parcelshop-picker/v4_1/styles/mondialrelay-widget.min.css">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: system-ui, sans-serif; background: #fff; }
    #mr-zone { width: 100%; }
  </style>
</head>
<body>
  <input type="hidden" id="mr-output">
  <div id="mr-zone"></div>
  <script src="https://code.jquery.com/jquery-3.7.1.min.js"></script>
  <script src="https://widget.mondialrelay.com/parcelshop-picker/v4_1/scripts/mondialrelay-widget.min.js"></script>
  <script>
    $(function () {
      $('#mr-zone').MR_ParcelShopPicker({
        Target:          '#mr-output',
        Brand:           '${brand}',
        PostCode:        '${cp}',
        Country:         'FR',
        ColLivMod:       '24R',
        NbResults:       '7',
        AllowedCountries:'FR',
        MapScrollWheel:  'false',
        Responsive:      'true',
      });
      $('#mr-output').on('change', function () {
        if (this.value) window.parent.postMessage(this.value, '*');
      });
    });
  </script>
</body>
</html>`);
}
