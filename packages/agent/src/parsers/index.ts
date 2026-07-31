/**
 * Parser barrel — the auto-collection manifest.
 *
 * Importing this module registers every builtin parser as a side effect. Fill
 * agents add a new parser by creating `src/parsers/<doctype>.ts` (which calls
 * `registerParser`) and APPENDING one side-effect import line below. This file
 * is the ONLY shared file a parser Fill agent touches; the registry itself is
 * never edited.
 */
import './invoice.js';
import './bill_of_lading.js';
import './packing_list.js';
import './certificate_of_origin.js';
import './customs_declaration.js';
import './inspection_report.js';
import './lab_report.js';
import './insurance_cert.js';
import './letter_of_credit.js';
import './phytosanitary.js';
import './halal_cert.js';
import './delivery_note.js';
import './weight_certificate.js';
import './dangerous_goods.js';
import './cold_chain_log.js';
import './generic.js';

export * from './registry.js';
