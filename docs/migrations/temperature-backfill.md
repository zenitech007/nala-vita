# F21: legacy temperature conversion

The selected Supabase project had zero vitals at inspection. The forward migration
therefore handles an empty temperature column and refuses to reinterpret existing
temperatures on any other database. It has not been applied remotely.

For a database with existing temperatures:

1. Pause temperature writes and take a verified backup. Inventory counts by proven
   source/version/unit; do not infer units from numeric magnitude. Unknown source
   readings require clinical data-owner review and remain unavailable for automated
   temperature thresholds until classified.
2. Prepare a separate reviewed reconciliation migration before deploying the new
   code. Add the three provenance columns, copy each existing temperature unchanged
   into `temperature_original`, and record its proven `temperature_original_unit`.
3. Convert only classified Fahrenheit readings with `(original - 32) * 5 / 9`,
   rounded to six decimal places. Classified Celsius values stay unchanged.
   Set `temperature_unit = 'C'`. Never convert an already canonical row a second time.
4. Validate aggregate counts, original-value preservation, one-to-one provenance and
   `98.6 F -> 37 C -> 98.6 F` on an isolated database. Resolve every unknown before
   enabling automated temperature evaluation. Add the checks from the forward
   migration and reconcile Prisma migration history explicitly; do not edit the
   historical baseline or blindly mark an unapplied migration as applied.
5. Resume writes only with an explicit input unit. Verify a synthetic reading in
   the API, patient/doctor charts, dashboard and AI context. Retain backup and the
   reviewed classification mapping for rollback/audit.

New API writes store canonical Celsius plus the submitted original value/unit.
The UI may display Fahrenheit by converting from canonical Celsius. Reverting UI
code must not reinterpret the canonical database value as Fahrenheit.
