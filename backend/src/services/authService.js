/**
 * @file services/authService.js
 * @description Servicio de autenticación, generación de tokens, control de intentos,
 * recuperación de contraseña por token y registro de clientes.
 * ChocoTi-Digital | Capa 2: Lógica de Negocio
 */

'use strict';

const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const Usuario = require('../models/Usuario');
const LogAcceso = require('../models/LogAcceso');
const EmailAdapter = require('../adapters/emailAdapter');

const JWT_SECRET = process.env.JWT_SECRET || 'chocoti_secret_sucre_bolivia_2026';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '8h';

class AuthService {
  /**
   * Procesa el inicio de sesión del usuario.
   * Valida credenciales, comprueba estado, controla bloqueo por intentos fallidos,
   * registra log obligatorio y genera JWT.
   *
   * @param {object} param
   * @param {string} param.email
   * @param {string} param.password
   * @param {string} param.ip
   * @returns {Promise<{token: string, usuario: object}>}
   */
  static async login({ email, password, ip = '127.0.0.1' }) {
    const emailNormalizado = (email || '').trim().toLowerCase();

    // 1. Buscar usuario por email (incluyendo password_hash y campos de bloqueo)
    const usuario = Usuario.findByEmail(emailNormalizado);

    if (!usuario) {
      // Registro obligatorio de intento fallido en logs_acceso (usuario inexistente)
      LogAcceso.registrar({
        usuario_id: null,
        ip_origen: ip,
        estado_login: 'FALLIDO',
        detalles: `Intento con correo inexistente: ${emailNormalizado}`,
      });

      // Mensaje genérico de seguridad: NO revela si el correo existe
      const error = new Error('Correo o contraseña incorrectos.');
      error.status = 401;
      throw error;
    }

    // 2. Verificar si la cuenta se encuentra temporalmente bloqueada
    if (usuario.bloqueado_hasta) {
      const ahora = new Date();
      const finBloqueo = new Date(usuario.bloqueado_hasta);

      if (finBloqueo > ahora) {
        LogAcceso.registrar({
          usuario_id: usuario.id,
          ip_origen: ip,
          estado_login: 'FALLIDO',
          detalles: `Intento en cuenta temporalmente bloqueada hasta ${usuario.bloqueado_hasta}`,
        });

        const error = new Error('Cuenta temporalmente bloqueada por seguridad tras múltiples intentos fallidos. Intente más tarde.');
        error.status = 403;
        throw error;
      } else {
        // El tiempo de bloqueo ya expiró: restablecer intentos automáticamente
        Usuario.resetearIntentosFallidos(usuario.id);
        usuario.intentos_fallidos = 0;
        usuario.bloqueado_hasta = null;
      }
    }

    // 3. Verificar estado general de la cuenta
    if (usuario.estado === 'INACTIVO') {
      LogAcceso.registrar({
        usuario_id: usuario.id,
        ip_origen: ip,
        estado_login: 'FALLIDO',
        detalles: 'Intento de acceso a cuenta inactiva',
      });

      const error = new Error('Su cuenta se encuentra inactiva. Por favor contacte al administrador.');
      error.status = 403;
      throw error;
    }

    // 4. Validar contraseña con bcrypt
    const coincidePassword = await bcrypt.compare(password, usuario.password_hash);

    if (!coincidePassword) {
      // Incrementar contador de intentos fallidos
      const estadoBloqueo = Usuario.incrementarIntentosFallidos(usuario.id);

      LogAcceso.registrar({
        usuario_id: usuario.id,
        ip_origen: ip,
        estado_login: 'FALLIDO',
        detalles: `Contraseña incorrecta (Intento ${estadoBloqueo.intentos_fallidos}/5)`,
      });

      if (estadoBloqueo.bloqueado) {
        const error = new Error('Cuenta temporalmente bloqueada por 15 minutos tras 5 intentos fallidos.');
        error.status = 403;
        throw error;
      }

      // Mensaje genérico de seguridad
      const error = new Error('Correo o contraseña incorrectos.');
      error.status = 401;
      throw error;
    }

    // 5. Credenciales válidas: Restablecer contador de fallos y registrar éxito
    Usuario.resetearIntentosFallidos(usuario.id);

    LogAcceso.registrar({
      usuario_id: usuario.id,
      ip_origen: ip,
      estado_login: 'EXITOSO',
      detalles: `Autenticación exitosa. Rol: ${usuario.rol}`,
    });

    Usuario.actualizarUltimaConexion(usuario.id);

    // 6. Generación de Token JWT
    const payload = {
      id: usuario.id,
      nombre_completo: usuario.nombre_completo,
      email: usuario.email,
      rol: usuario.rol,
      rol_id: usuario.rol_id,
      almacen_id: usuario.almacen_id,
      tipo_cliente: usuario.tipo_cliente,
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    // 7. Preparar objeto de usuario seguro (PROHIBIDO devolver contraseñas o hashes)
    const usuarioSeguro = {
      id: usuario.id,
      nombre_completo: usuario.nombre_completo,
      email: usuario.email,
      rol: usuario.rol,
      rol_id: usuario.rol_id,
      almacen_id: usuario.almacen_id,
      almacen_nombre: usuario.almacen_nombre,
      tipo_cliente: usuario.tipo_cliente,
      razon_social: usuario.razon_social,
      ci_nit: usuario.ci_nit,
      telefono: usuario.telefono,
    };

    return {
      token,
      usuario: usuarioSeguro,
    };
  }

  /**
   * Registro público autónomo para clientes (Minorista o Corporativo).
   * El backend fuerza estrictamente los roles permitidos (3 y 4) e ignora roles privilegiados.
   *
   * @param {object} param
   * @returns {Promise<{token: string, usuario: object}>}
   */
  static async register({ nombre_completo, email, password, tipo_cliente = 'MINORISTA', razon_social, ci_nit, telefono, ip = '127.0.0.1' }) {
    const emailNormalizado = (email || '').trim().toLowerCase();

    // 1. Validar si el email ya existe
    const usuarioExistente = Usuario.findByEmail(emailNormalizado);
    if (usuarioExistente) {
      const error = new Error('El correo electrónico ya se encuentra registrado.');
      error.status = 409;
      throw error;
    }

    // 2. Validación de complejidad de contraseña (mínimo 8 caracteres, 1 mayúscula, 1 minúscula, 1 número)
    const regexComplejidad = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    if (!regexComplejidad.test(password)) {
      const error = new Error('La contraseña debe tener al menos 8 caracteres, incluyendo una letra mayúscula, una minúscula y un número.');
      error.status = 422;
      throw error;
    }

    // 3. Validación de requerimientos para Cliente Corporativo (B2B)
    const esCorporativo = String(tipo_cliente).toUpperCase() === 'CORPORATIVO';
    if (esCorporativo) {
      if (!razon_social || !razon_social.trim()) {
        const error = new Error('La Razón Social es obligatoria para el registro de clientes corporativos.');
        error.status = 422;
        throw error;
      }
      if (!ci_nit || !ci_nit.trim()) {
        const error = new Error('El NIT es obligatorio para el registro de clientes corporativos.');
        error.status = 422;
        throw error;
      }
    }

    // 4. Hasheo seguro de la contraseña con bcrypt (10 rondas de costo)
    const passwordHash = await bcrypt.hash(password, 10);

    // 5. Creación en la base de datos (seguro contra manipulación de rol)
    const nuevoUsuario = Usuario.createClientePublico({
      nombre_completo,
      email: emailNormalizado,
      password_hash: passwordHash,
      tipo_cliente: esCorporativo ? 'CORPORATIVO' : 'MINORISTA',
      razon_social,
      ci_nit,
      telefono,
    });

    // 6. Registrar en bitácora de accesos
    LogAcceso.registrar({
      usuario_id: nuevoUsuario.id,
      ip_origen: ip,
      estado_login: 'EXITOSO',
      detalles: `Registro de nueva cuenta (${nuevoUsuario.rol})`,
    });

    // 7. Emitir token JWT
    const payload = {
      id: nuevoUsuario.id,
      nombre_completo: nuevoUsuario.nombre_completo,
      email: nuevoUsuario.email,
      rol: nuevoUsuario.rol,
      rol_id: nuevoUsuario.rol_id,
      almacen_id: null,
      tipo_cliente: nuevoUsuario.tipo_cliente,
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    return {
      token,
      usuario: nuevoUsuario,
    };
  }

  /**
   * Genera un token de un solo uso con expiración para restablecer la contraseña.
   * Envía las instrucciones mediante el adaptador de correo.
   * Responde siempre de forma genérica para no revelar existencia del correo.
   *
   * @param {object} param
   * @param {string} param.email
   * @param {string} param.ip
   * @returns {Promise<{ mensaje: string }>}
   */
  static async recuperarPassword({ email, ip = '127.0.0.1' }) {
    const emailNormalizado = (email || '').trim().toLowerCase();
    const usuario = Usuario.findByEmail(emailNormalizado);

    if (usuario && usuario.estado === 'ACTIVO') {
      // Token criptográficamente seguro
      const token = crypto.randomBytes(32).toString('hex');
      const expiraEn = new Date(Date.now() + 60 * 60 * 1000).toISOString(); // 1 hora

      Usuario.guardarTokenRecuperacion(usuario.id, token, expiraEn);

      const appBaseUrl = process.env.APP_BASE_URL || 'http://localhost:3001';
      const linkRecuperacion = `${appBaseUrl}/frontend/auth/login.html?token=${token}&modo=recuperar`;

      const contenidoHtml = `
        <div style="font-family: sans-serif; max-width: 500px; margin: 0 auto; padding: 20px; border: 1px solid #E8DDD5; border-radius: 10px;">
          <h2 style="color: #2C1A1D;">🍫 Chocolates Para Ti — Recuperación de Contraseña</h2>
          <p>Hola <strong>${usuario.nombre_completo}</strong>,</p>
          <p>Hemos recibido una solicitud para restablecer la contraseña de su cuenta en ChocoTi-Digital.</p>
          <p>Para ingresar una nueva contraseña, presione el siguiente enlace (válido durante 1 hora):</p>
          <p style="text-align: center; margin: 25px 0;">
            <a href="${linkRecuperacion}" style="background-color: #D4AF37; color: #2C1A1D; font-weight: bold; padding: 12px 24px; text-decoration: none; border-radius: 20px;">
              Restablecer mi Contraseña
            </a>
          </p>
          <p style="font-size: 0.85rem; color: #777;">Si usted no solicitó este cambio, puede ignorar este mensaje de forma segura.</p>
        </div>
      `;

      await EmailAdapter.enviarCorreo({
        destinatario: usuario.email,
        asunto: 'Recuperación de Contraseña — Chocolates Para Ti',
        contenidoHtml,
        tipo: 'RECUPERAR_PASSWORD',
      });

      LogAcceso.registrar({
        usuario_id: usuario.id,
        ip_origen: ip,
        estado_login: 'EXITOSO',
        detalles: 'Solicitud de token de recuperación de contraseña',
      });
    }

    // Respuesta genérica deliberada: NO revela si el email está registrado o no
    return {
      mensaje: 'Si el correo electrónico está registrado, hemos enviado las instrucciones para restablecer su contraseña.',
    };
  }

  /**
   * Restablece la contraseña utilizando el token de recuperación emitido.
   *
   * @param {object} param
   * @param {string} param.token
   * @param {string} param.password_nueva
   * @param {string} param.password_confirmar
   * @returns {Promise<{ mensaje: string }>}
   */
  static async restablecerPassword({ token, password_nueva, password_confirmar }) {
    if (!token || !password_nueva || !password_confirmar) {
      const error = new Error('Todos los campos son obligatorios.');
      error.status = 400;
      throw error;
    }

    if (password_nueva !== password_confirmar) {
      const error = new Error('La nueva contraseña y su confirmación no coinciden.');
      error.status = 422;
      throw error;
    }

    // Complejidad
    const regexComplejidad = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    if (!regexComplejidad.test(password_nueva)) {
      const error = new Error('La nueva contraseña debe tener mínimo 8 caracteres, al menos una mayúscula, una minúscula y un número.');
      error.status = 422;
      throw error;
    }

    const usuario = Usuario.findByTokenRecuperacion(token);
    if (!usuario) {
      const error = new Error('El enlace de recuperación es inválido o ha expirado. Por favor solicite uno nuevo.');
      error.status = 400;
      throw error;
    }

    const nuevoHash = await bcrypt.hash(password_nueva, 10);
    Usuario.restablecerPasswordConToken(usuario.id, nuevoHash);

    LogAcceso.registrar({
      usuario_id: usuario.id,
      ip_origen: '127.0.0.1',
      estado_login: 'EXITOSO',
      detalles: 'Contraseña restablecida exitosamente mediante token',
    });

    return {
      mensaje: 'Contraseña restablecida correctamente. Ya puede iniciar sesión con su nueva clave.',
    };
  }

  /**
   * Obtiene el perfil del usuario autenticado.
   * @param {number} usuarioId
   * @returns {object}
   */
  static getPerfil(usuarioId) {
    const usuario = Usuario.findById(usuarioId);
    if (!usuario) {
      const error = new Error('Usuario no encontrado.');
      error.status = 404;
      throw error;
    }
    return usuario;
  }

  /**
   * Actualiza los datos permitidos del perfil propio.
   * @param {number} usuarioId
   * @param {object} datos
   * @returns {object}
   */
  static updatePerfil(usuarioId, datos) {
    const permitidos = {};
    if (datos.nombre_completo !== undefined) permitidos.nombre_completo = datos.nombre_completo.trim();
    if (datos.telefono !== undefined) permitidos.telefono = datos.telefono ? datos.telefono.trim() : null;
    if (datos.ci_nit !== undefined) permitidos.ci_nit = datos.ci_nit ? datos.ci_nit.trim() : null;
    if (datos.razon_social !== undefined) permitidos.razon_social = datos.razon_social ? datos.razon_social.trim() : null;

    if (Object.keys(permitidos).length === 0) {
      const error = new Error('No se proporcionaron campos válidos para actualizar.');
      error.status = 400;
      throw error;
    }

    const actualizado = Usuario.update(usuarioId, permitidos);
    if (!actualizado) {
      const error = new Error('Usuario no encontrado.');
      error.status = 404;
      throw error;
    }
    return actualizado;
  }

  /**
   * Modifica la contraseña del usuario tras validar la anterior y la complejidad.
   *
   * @param {number} usuarioId
   * @param {object} param
   * @param {string} param.password_actual
   * @param {string} param.password_nueva
   * @param {string} param.password_confirmar
   */
  static async cambiarPassword(usuarioId, { password_actual, password_nueva, password_confirmar }) {
    if (!password_actual || !password_nueva || !password_confirmar) {
      const error = new Error('Debe proporcionar la contraseña actual, la nueva contraseña y su confirmación.');
      error.status = 400;
      throw error;
    }

    if (password_nueva !== password_confirmar) {
      const error = new Error('La nueva contraseña y su confirmación no coinciden.');
      error.status = 422;
      throw error;
    }

    const regexComplejidad = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    if (!regexComplejidad.test(password_nueva)) {
      const error = new Error('La nueva contraseña debe tener mínimo 8 caracteres, al menos una mayúscula, una minúscula y un número.');
      error.status = 422;
      throw error;
    }

    const usuario = Usuario.findWithPasswordById(usuarioId);
    if (!usuario) {
      const error = new Error('Usuario no encontrado.');
      error.status = 404;
      throw error;
    }

    const coincideActual = await bcrypt.compare(password_actual, usuario.password_hash);
    if (!coincideActual) {
      const error = new Error('La contraseña actual es incorrecta.');
      error.status = 401;
      throw error;
    }

    const nuevoHash = await bcrypt.hash(password_nueva, 10);
    Usuario.cambiarPassword(usuarioId, nuevoHash);

    return { mensaje: 'Contraseña actualizada correctamente.' };
  }
}

module.exports = AuthService;
