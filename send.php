<?php
header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: POST');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
    exit;
}

$prenom = trim($_POST['prenom'] ?? '');
$nom    = trim($_POST['nom']    ?? '');
$tel    = trim($_POST['tel']    ?? '');
$email  = trim($_POST['email']  ?? '');

if (!$prenom || !$nom || !$tel || !$email) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Champs manquants']);
    exit;
}

if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    http_response_code(400);
    echo json_encode(['ok' => false, 'error' => 'Email invalide']);
    exit;
}

$to      = 'contact@yourqr.page';
$subject = '=?UTF-8?B?' . base64_encode('🍎 Nouveau contact BroKa — ' . $prenom . ' ' . $nom) . '?=';
$body    = "Nouveau contact via la page BroKa :\n\n"
         . "Prénom    : $prenom\n"
         . "Nom       : $nom\n"
         . "Email     : $email\n"
         . "Téléphone : $tel\n\n"
         . "---\nReçu le " . date('d/m/Y à H:i') . "\n";

$headers  = "From: noreply@yourqr.page\r\n";
$headers .= "Reply-To: $email\r\n";
$headers .= "Content-Type: text/plain; charset=UTF-8\r\n";

$sent = mail($to, $subject, $body, $headers);

echo json_encode(['ok' => $sent]);
