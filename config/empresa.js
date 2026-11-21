/**
 * @file config/empresa.js
 * @description Configuración centralizada de la empresa Chocolates Para Ti (Solur S.R.L.).
 * Todos los datos no especificados se mantienen explícitamente como "POR DEFINIR"
 * para no inventar información corporativa o fiscal.
 */

'use strict';

const EMPRESA_CONFIG = {
  // ── Identidad Corporativa ──
  nombreComercial: 'Chocolates Para Ti',
  razonSocial: 'Solur S.R.L.',
  lema: 'El mejor Chocolate de toda Bolivia',
  fechaFundacion: '1990-05-27',
  ciudadOrigen: 'Sucre, Bolivia',

  // ── Datos Legales y Fiscales ──
  // De acuerdo con la directriz: no inventar NIT ni cuentas bancarias si no fueron provistos
  nit: null, // POR DEFINIR
  correoContacto: null, // POR DEFINIR (ej. info@chocolatesti.bo)
  horariosAtencion: 'Horario comercial habitual / Por definir',

  // ── Canales Oficiales y Redes Sociales ──
  redesSociales: {
    facebook: 'https://www.facebook.com/paratichocolates/',
    instagram: 'https://www.instagram.com/chocolates_parati/',
    whatsapp: '+591 71163789',
    whatsappUrl: 'https://wa.me/59171163789',
    mensajePredeterminadoWhatsApp: 'Hola Chocolates Para Ti, me gustaría consultar sobre sus productos y pedidos web.',
  },

  // ── Cuentas Bancarias para Transferencias (POR DEFINIR) ──
  datosBancarios: {
    banco: 'Por definir',
    tipoCuenta: 'Por definir',
    numeroCuenta: 'Por definir',
    titular: 'Solur S.R.L.',
    instrucciones: 'Realice la transferencia bancaria y adjunte su comprobante digital (imagen o PDF máx 2 MB) o indique el número de transacción.',
  },

  // ── Tiempos de Reserva Temporal de Stock en Checkout (en milisegundos y minutos) ──
  tiemposReservaStock: {
    QR: {
      minutos: 15,
      milisegundos: 15 * 60 * 1000,
      descripcion: '15 minutos para confirmación automática de Pago QR Simple',
    },
    TRANSFERENCIA: {
      horas: 24,
      milisegundos: 24 * 60 * 60 * 1000,
      descripcion: '24 horas para verificación de comprobante bancario',
    },
    EFECTIVO_TIENDA: {
      horas: 48,
      milisegundos: 48 * 60 * 60 * 1000,
      descripcion: '48 horas para recojo y pago en efectivo en agencia propia (Tipo P)',
    },
  },

  // ── Políticas de Envíos y Costos (Base por definir / editable) ──
  envios: {
    costoSucreLocal: 0.0, // Envíos locales o recojo en agencia
    costoNacionalBase: 25.0, // Tarifa plana base para resto de Bolivia (por definir con precisión)
    diasHabilesEntregaNacional: '48 a 72 horas hábiles',
  },

  // ── Categorías Oficiales ──
  categorias: [
    'Combos',
    'Chocolates en Cajas Artesanales',
    'Chocolates en Cajas',
    'Grageas en Bolsa',
    'Tabletas de Chocolate',
    'Paletas',
    'Chocolates en Bolsa',
  ],

  // ── Catálogo Semilla Inicial (12 SKUs oficiales con precios en Bs sin flete) ──
  catalogoSemilla: [
    { sku: '3BOLBOM100', nombre: 'Bolsa bombón con crema 100 g', precio: 15.5, categoria: 'Chocolates en Bolsa' },
    { sku: '3BOLBOM200', nombre: 'Bolsa bombón con crema 200 g', precio: 30.0, categoria: 'Chocolates en Bolsa' },
    { sku: '3BOLCHF100', nombre: 'Bolsa chocolate con fruta 100 g', precio: 22.0, categoria: 'Chocolates en Bolsa' },
    { sku: '3BOLCHR100', nombre: 'Bolsa chocolates rellenos 100 g', precio: 23.5, categoria: 'Chocolates en Bolsa' },
    { sku: '3BOLCHS100', nombre: 'Bolsa chocolates con sabores 100 g', precio: 22.5, categoria: 'Chocolates en Bolsa' },
    { sku: '3BOLGAL050', nombre: 'Grageas de almendras 50 g', precio: 7.0, categoria: 'Grageas en Bolsa' },
    { sku: '3BOLGAL100', nombre: 'Grageas de almendras 100 g', precio: 14.0, categoria: 'Grageas en Bolsa' },
    { sku: '3BOLGAR050', nombre: 'Grageas de arroz 50 g', precio: 7.0, categoria: 'Grageas en Bolsa' },
    { sku: '3BOLGAR100', nombre: 'Grageas de arroz 100 g', precio: 14.0, categoria: 'Grageas en Bolsa' },
    { sku: '3BOLGMA050', nombre: 'Grageas de maní 50 g', precio: 7.0, categoria: 'Grageas en Bolsa' },
    { sku: '3BOLGMA100', nombre: 'Grageas de maní 100 g', precio: 14.0, categoria: 'Grageas en Bolsa' },
    { sku: '3BOLGMC050', nombre: 'Grageas de macarrón 50 g', precio: 7.0, categoria: 'Grageas en Bolsa' },
  ],
};

module.exports = EMPRESA_CONFIG;
