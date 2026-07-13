function words(list) {
  return list.split(", ");
}

export const vocabularySections = [
  {
    id: "grundlagen",
    title: "Grundlagen",
    nomen: words(
      "der Kunde, die Kundin, die Beschwerde, das Anliegen, die Lösung, das Problem, die Geduld, der Ablauf, die Rückmeldung, die Zufriedenheit, die Eskalation, der Vorgesetzte, die Vorgesetzte, das Gespräch, der Anruf, die Anfrage, die Antwort, die Erklärung, die Information, der Vorschlag, die Entschuldigung, das Verständnis, die Höflichkeit, der Respekt, die Sicherheit, das Vertrauen, die Erfahrung, der Eindruck, die Stimme, der Tonfall, die Ruhe, der Stress, die Situation, der Vorfall, das Missverständnis, die Klärung, der Kompromiss, die Alternative, die Entscheidung, die Verantwortung, die Richtlinie, die Ausnahme, die Kulanz, der Fehler, die Korrektur, die Bestätigung, die Rückfrage, das Feedback, die Zusammenfassung, der Kontext, die Priorität, die Dringlichkeit, das Ziel, die Erwartung, die Enttäuschung, die Frustration, die Erleichterung, die Dankbarkeit, die Loyalität, der Ruf, die Reklamation, die Nachfrage, die Wartezeit, die Warteschleife, der Rückruf, die Weiterleitung, die Abteilung, das Team, die Zusammenarbeit, die Qualität, der Standard"
    ),
    verben: words(
      "zuhören, entschuldigen, klären, weiterleiten, beruhigen, nachfragen, bestätigen, zusammenfassen, eskalieren, sich kümmern um, verstehen, erklären, vorschlagen, anbieten, lösen, reagieren, antworten, informieren, unterstützen, helfen, überprüfen, bearbeiten, dokumentieren, notieren, kontaktieren, zurückrufen, warten, versichern, garantieren, empfehlen, überzeugen, verhandeln, vermitteln, akzeptieren, ablehnen, begründen, wiederholen, präzisieren, zusammenarbeiten, priorisieren, delegieren, nachhaken, beschwichtigen, entschärfen, deeskalieren"
    ),
    adjektive: words(
      "freundlich, geduldig, professionell, ruhig, verständnisvoll, hilfsbereit, kompetent, ehrlich, transparent, zuverlässig, aufmerksam, respektvoll, empathisch, sachlich, klar, präzise, flexibel, engagiert, zuvorkommend, souverän, gelassen, überzeugend, diplomatisch, verbindlich, glaubwürdig, kundenorientiert, lösungsorientiert, konstruktiv, taktvoll, entgegenkommend"
    ),
    phrasen: [
      "Ich verstehe total, dass das frustrierend ist.",
      "Lassen Sie uns gemeinsam eine Lösung finden.",
      "Ich entschuldige mich für die Unannehmlichkeiten.",
      "Darf ich kurz zusammenfassen, was ich verstanden habe?",
      "Ich kläre das gerne für Sie.",
      "Ich nehme Ihr Anliegen sehr ernst.",
      "Haben Sie noch weitere Fragen?",
      "Vielen Dank für Ihre Geduld.",
      "Ich melde mich schnellstmöglich bei Ihnen zurück.",
      "Gibt es sonst noch etwas, womit ich helfen kann?",
    ],
  },
  {
    id: "telekommunikation",
    title: "Telekommunikation",
    nomen: words(
      "der Tarif, die Rechnung, der Vertrag, die Kündigung, das Datenvolumen, die Bandbreite, der Anschluss, die Störung, die Gebühr, das Roaming, die SIM-Karte, der Anbieter, das Netz, der Router, die Rufnummer, die Portierung, die Mahnung, die Flatrate, der Datentarif, die Hotline, das Netzwerk, die Verbindung, der Empfang, die Frequenz, der Netzausbau, die Glasfaser, das Mobilfunknetz, die Rufumleitung, die Mailbox, der Anrufbeantworter, das Prepaid, das Postpaid, die Vertragslaufzeit, die Kündigungsfrist, der Wechsel, das Guthaben, die Aufladung, der Handyvertrag, das Endgerät, das Smartphone, die eSIM, der Datenverbrauch, die Drosselung, das Update, die Firmware, die Störungsmeldung, der Techniker, die Reparatur, der Ersatz, das Zubehör, die Ladestation, das Kabel, der Adapter, die Sicherung, der Datenschutz, die Zustimmung, die Vollmacht, der Kontoinhaber, die Bonität, die Bankverbindung, das Lastschriftverfahren, die Überweisung, die Mahngebühr, das Inkasso, die Reklamationsstelle, der Kundenberater, die Servicehotline, die Vertragsverlängerung, das Bonusprogramm, die Treueprämie"
    ),
    verben: words(
      "kündigen, wechseln, aufladen, beantragen, freischalten, sperren, entsperren, erstatten, beheben, verlängern, reduzieren, aktivieren, deaktivieren, umbuchen, portieren, registrieren, anmelden, abmelden, einrichten, konfigurieren, aktualisieren, installieren, deinstallieren, zurücksetzen, überprüfen, testen, melden, dokumentieren, weiterleiten, eskalieren, entschädigen, gutschreiben, buchen, stornieren, drosseln, entdrosseln, verbinden, trennen, synchronisieren"
    ),
    adjektive: words(
      "stabil, instabil, verfügbar, unterbrochen, verschlüsselt, kompatibel, funktionsfähig, defekt, überlastet, zuverlässig, schnell, langsam, mobil, kabellos, kabelgebunden"
    ),
    phrasen: [
      "Ihr Anschluss wird in Kürze freigeschaltet.",
      "Die Störung wird schnellstmöglich behoben.",
      "Ihr Vertrag läuft zum Monatsende aus.",
      "Ihr Datenvolumen ist für diesen Monat aufgebraucht.",
      "Die Rufnummer kann problemlos portiert werden.",
      "Ich schalte den neuen Tarif sofort für Sie frei.",
      "Die Kündigungsfrist beträgt einen Monat zum Vertragsende.",
      "Ich sende Ihnen einen Techniker innerhalb von 48 Stunden.",
      "Ihre SIM-Karte wird in Kürze aktiviert.",
      "Ich prüfe gerne den aktuellen Stand Ihrer Bestellung.",
    ],
  },
  {
    id: "einzelhandel",
    title: "Einzelhandel",
    nomen: words(
      "der Kassenbon, die Rückgabe, der Umtausch, das Angebot, der Rabatt, die Garantie, der Artikel, die Filiale, der Bestand, die Kundenkarte, die Ratenzahlung, die Aktion, der Verkauf, die Kasse, das Regal, die Ware, der Preis, das Preisschild, die Quittung, die Rechnung, der Einkaufswagen, die Umkleidekabine, das Sortiment, die Marke, die Größe, die Farbe, das Material, die Qualität, der Hersteller, die Lieferzeit, die Bestellung, die Abholung, der Versand, die Retoure, das Paket, die Sendung, der Gutschein, die Mitgliedschaft, die Treuepunkte, die Rabattaktion, der Sonderpreis, die Reduzierung, der Ausverkauf, die Saison, die Neuheit, das Zubehör, die Verpackung, das Etikett, die Größentabelle, die Anprobe, der Kundendienst, die Beratung, die Empfehlung, der Vergleich, die Alternative, die Verfügbarkeit, die Nachbestellung, die Reservierung, der Lagerbestand, die Inventur, die Kassiererin"
    ),
    verben: words(
      "zurückgeben, umtauschen, reduzieren, reservieren, liefern, abholen, stornieren, vorführen, anprobieren, kaufen, verkaufen, bezahlen, bestellen, versenden, zurücksenden, empfehlen, beraten, vergleichen, prüfen, kontrollieren, einpacken, auspacken, etikettieren, scannen, kassieren, buchen, nachbestellen, vorrätig haben, ausverkaufen, anbieten, präsentieren, erklären, informieren"
    ),
    adjektive: words(
      "reduziert, ausverkauft, vorrätig, verfügbar, defekt, beschädigt, originalverpackt, neuwertig, gebraucht, hochwertig, günstig, teuer, passend, unpassend, praktisch"
    ),
    phrasen: [
      "Haben Sie noch den Kassenbon dabei?",
      "Ich prüfe gerne, ob der Artikel noch vorrätig ist.",
      "Der Umtausch ist innerhalb von 14 Tagen möglich.",
      "Dieser Artikel ist aktuell reduziert.",
      "Ich bestelle den Artikel gerne aus einer anderen Filiale.",
      "Die Lieferung dauert in der Regel drei bis fünf Werktage.",
      "Ich kann Ihnen einen Gutschein als Entschädigung anbieten.",
      "Möchten Sie den Artikel anprobieren?",
    ],
  },
  {
    id: "reise-tourismus",
    title: "Reise & Tourismus",
    nomen: words(
      "die Buchung, die Stornierung, der Flug, die Umbuchung, das Visum, die Reiseversicherung, die Anzahlung, die Unterkunft, die Zwischenlandung, das Gepäck, die Einreisebestimmung, die Ermäßigung, der Reisepass, der Personalausweis, die Fluggesellschaft, das Ticket, der Sitzplatz, die Bordkarte, der Abflug, die Ankunft, die Verspätung, der Anschlussflug, das Terminal, das Gate, die Sicherheitskontrolle, der Zoll, die Reiseroute, das Hotel, das Zimmer, die Halbpension, die Vollpension, das Reisebüro, der Reiseveranstalter, die Pauschalreise, die Individualreise, die Destination, der Ausflug, die Sehenswürdigkeit, die Attraktion, der Reiseleiter, die Gruppenreise, das Einzelzimmer, das Doppelzimmer, die Reisezeit, die Nebensaison, die Hauptsaison, der Koffer, das Handgepäck, die Gepäckaufgabe, der Gepäckverlust, die Rückerstattung, die Buchungsbestätigung, die Kreditkarte"
    ),
    verben: words(
      "buchen, stornieren, umbuchen, einchecken, bestätigen, absagen, nachfragen, reservieren, planen, verlängern, verschieben, abfliegen, ankommen, landen, verpassen, umsteigen, kontrollieren, verzollen, packen, auspacken, empfehlen, beraten, vergleichen, informieren, versichern, erstatten, entschädigen, organisieren, koordinieren, begleiten"
    ),
    adjektive: words(
      "pünktlich, verspätet, ausgebucht, verfügbar, storniert, bestätigt, inklusive, exklusive, direkt, indirekt, komfortabel, erschwinglich, exotisch, abgelegen, beliebt"
    ),
    phrasen: [
      "Ihre Buchung ist hiermit bestätigt.",
      "Ich prüfe gerne die aktuellen Stornobedingungen.",
      "Der Flug hat eine kurze Zwischenlandung.",
      "Ich empfehle Ihnen zusätzlich eine Reiseversicherung.",
      "Ich kümmere mich sofort um eine alternative Verbindung.",
      "Die Rückerstattung dauert in der Regel wenige Tage.",
      "Bitte denken Sie an Ihren gültigen Reisepass.",
      "Ihr Gepäck wird direkt bis zum Zielort durchgecheckt.",
    ],
  },
  {
    id: "gastgewerbe",
    title: "Gastgewerbe",
    nomen: words(
      "die Reservierung, das Zimmer, der Check-in, der Check-out, die Rezeption, der Aufenthalt, die Kurtaxe, das Frühstück, das Upgrade, der Sonderwunsch, die Minibar, der Zimmerservice, die Bettwäsche, das Handtuch, die Reinigung, das Housekeeping, der Gast, die Beschwerde, der Lärm, die Ruhe, die Aussicht, der Balkon, das Bad, die Dusche, die Badewanne, der Fernseher, das WLAN, der Parkplatz, die Garage, das Restaurant, die Bar, der Pool, das Spa, die Sauna, der Fitnessraum, der Konferenzraum, die Veranstaltung, die Hochzeit, die Feier, das Bankett, der Zimmerpreis, die Nebenkosten, die Anzahlung, die Kaution, die Stornierung, die Verlängerung, die Verkürzung, der Aufpreis, die Ausstattung, der Komfort, die Sauberkeit, der Service, die Bewertung, die Empfehlung, das Erlebnis, die Atmosphäre"
    ),
    verben: words(
      "reservieren, einchecken, auschecken, upgraden, bereitstellen, organisieren, wechseln, reinigen, aufräumen, servieren, anbieten, empfehlen, buchen, verlängern, verkürzen, stornieren, begrüßen, verabschieden, betreuen, versorgen, informieren, beraten, entschuldigen, kompensieren, entschädigen, sich kümmern um, koordinieren, vorbereiten, ausstatten, dekorieren"
    ),
    adjektive: words(
      "gemütlich, ruhig, laut, sauber, gepflegt, komfortabel, geräumig, hell, dunkel, modern, klassisch, luxuriös, einfach, freundlich, gastfreundlich"
    ),
    phrasen: [
      "Herzlich willkommen, wie kann ich Ihnen helfen?",
      "Der Check-in ist ab 14 Uhr möglich.",
      "Ich organisiere Ihnen gerne ein anderes Zimmer.",
      "Das Frühstück ist im Zimmerpreis inbegriffen.",
      "Ich entschuldige mich für die Unannehmlichkeiten.",
      "Ich kümmere mich sofort darum.",
      "Der Check-out ist bis 11 Uhr möglich.",
      "Wir wünschen Ihnen einen angenehmen Aufenthalt.",
    ],
  },
  {
    id: "autovermietung",
    title: "Autovermietung",
    nomen: words(
      "die Vollkasko, die Teilkasko, die Kaution, der Mietwagen, die Kilometerbegrenzung, die Tankregelung, der Führerschein, die Zusatzversicherung, der Schaden, die Altersgrenze, die Anmietung, die Rückgabe, die Übergabe, das Fahrzeug, das Modell, die Fahrzeugklasse, der Kleinwagen, die Limousine, der Kombi, das Cabrio, der Geländewagen, die Automatik, die Schaltung, der Tank, das Benzin, der Diesel, die Elektrik, die Reifen, das Navigationsgerät, der Kindersitz, die Anhängerkupplung, die Zusatzausstattung, der Fahrer, der Zweitfahrer, die Buchungsbestätigung, der Mietvertrag, die Mietdauer, die Verlängerung, die Verspätung, die Panne, der Unfall, die Versicherungssumme, die Selbstbeteiligung, die Reparatur, die Werkstatt, der Ersatzwagen, die Fahrzeugübergabe, das Übergabeprotokoll, der Kilometerstand, die Grenzüberschreitung, die Genehmigung, die Gebühr, die Zusatzkosten, die Reinigungsgebühr, die Strafgebühr"
    ),
    verben: words(
      "mieten, versichern, verlängern, upgraden, dokumentieren, reservieren, zurückgeben, übergeben, überprüfen, tanken, reinigen, beschädigen, reparieren, ersetzen, buchen, stornieren, abholen, ausliefern, kontrollieren, bestätigen, verzichten, einschließen, ausschließen, berechnen, erstatten, entschädigen, klären, erklären, fahren, parken"
    ),
    adjektive: words(
      "versichert, unversichert, beschädigt, unbeschädigt, sauber, verschmutzt, vollgetankt, leer, verfügbar, ausgebucht, geeignet, ungeeignet, komfortabel, geräumig, sparsam"
    ),
    phrasen: [
      "Das Fahrzeug wird mit vollem Tank übergeben.",
      "Ich empfehle Ihnen die Vollkaskoversicherung.",
      "Die Kaution wird nach der Rückgabe wieder freigegeben.",
      "Für zusätzliche Fahrer fällt eine kleine Gebühr an.",
      "Bitte geben Sie das Fahrzeug am vereinbarten Ort zurück.",
      "Ich dokumentiere den aktuellen Zustand des Fahrzeugs.",
      "Ein gültiger Führerschein ist bei der Abholung erforderlich.",
      "Die Kilometerbegrenzung liegt bei 200 Kilometern pro Tag.",
    ],
  },
];
