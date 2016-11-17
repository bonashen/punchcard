'use strict';

/**
 * @fileoverview Login routing
 */
const config = require('config');
const types = require('punchcard-content-types');
const multipart = require('connect-multiparty');
const multipartMiddleware = multipart();
const bcrypt = require('bcrypt-nodejs');

const acl = require('../auth/acl');
const getUserId = acl.getUserId;
const users = require('../users');
const database = require('../database');

/*
 * Users Route Handling
 * @description Adds user management routes handling to an Express app
 *
 * @param {object} application - Express Application
 * @returns {object} - Configured Express Application
 */
const routes = application => {
  const app = application;

  return new Promise(resolve => {
    /*
     *  Landing for all users
     */
    app.get(config.users.setup.path, users.routes.setup);

    /*
     *  Landing for all users
     */
    app.get(`/${config.users.base}`, users.routes.all);

    /*
     * @name Add new user
     *
     * @param {object} req - HTTP Request
     * @param {object} res - HTTP Response
     * @param {object} next - Express callback
    */
    app.get(`/${config.users.base}/${config.users.actions.add}`, acl.middleware(1, getUserId, 'create'), (req, res, next) => {
      return types.form(req.users.model, null, config).then(form => {
        res.render('users/add', {
          title: config.users.actions.add,
          form,
          action: `/${config.users.base}/${config.users.actions.add}`,
          user: req.user,
        });
      }).catch(error => {
        next(error);
      });
    });

    /*
     * @name Add new user POST method
     *
     * @param {object} req - HTTP Request
     * @param {object} res - HTTP Response
     * @param {object} next - Express callback
    */
    app.post(`/${config.users.base}/${config.users.actions.add}`, [
      multipartMiddleware,
      acl.middleware(1, getUserId, 'create'),
    ], (req, res, next) => {
      const data = {
        email: req.body['email--email'],
        role: req.body['role--select'],
        password: bcrypt.hashSync(req.body['password--password']),
      };
      database('users').insert(data).then(() => {
        res.redirect(`/${config.users.base}`);
      })
      .catch(err => {
        next(err);
      });
    });

    /*
     * @name Edit a user
     *
     * @param {object} req - HTTP Request
     * @param {object} res - HTTP Response
     * @param {object} next - Express callback
    */
    app.get(`/${config.users.base}/:id/${config.users.actions.edit}`, acl.middleware(1, getUserId, 'update'), (req, res, next) => {
      let user;

      // turnd off eslint: should be allowed to change req.session
      req.session.userEditId = req.params.id; // eslint-disable-line no-param-reassign

      return database('users').where('id', req.params.id).then(rows => {
        if (rows.length < 1) {
          const error = {
            message: config.users.messages.errors.edit,
            status: 404,
            safe: '/users',
          };

          return next(error);
        }
        user = rows[0];

        return types.only('users', {
          'email': {
            'email': {
              'value': user.email,
            },
          },
          'role': {
            'select': {
              'value': user.role,
            },
          },
        }, req.users.model, config);
      }).then(result => {
        return types.form(result, null, config);
      }).then(form => {
        res.render('users/add', {
          title: config.users.actions.edit,
          form,
          action: `/${config.users.base}/${config.users.actions.edit}`,
          user: req.user,
        });
      })
      .catch(error => {
        next(error);
      });
    });

    /*
     * @name Edit user POST method
     *
     * @param {object} req - HTTP Request
     * @param {object} res - HTTP Response
     * @param {object} next - Express callback
    */
    app.post(`/${config.users.base}/${config.users.actions.edit}`, [
      multipartMiddleware,
      acl.middleware(1, getUserId, 'update'),
    ], (req, res, next) => {
      const data = {
        email: req.body['email--email'],
        role: req.body['role--select'],
      };

      database('users').where('id', '=', req.session.userEditId).update(data)
        .then(() => {
          // turnd off eslint: should be allowed to change req.session
          delete req.session.editUserId; // eslint-disable-line no-param-reassign
          res.redirect(`/${config.users.base}`);
        })
        .catch(error => {
          next(error);
        });
    });

    /*
     * @name Delete a user
     *
     * @param {object} req - HTTP Request
     * @param {object} res - HTTP Response
     * @param {object} next - Express callback
    */
    app.get(`/${config.users.base}/:id/${config.users.actions.delete}`, acl.middleware(1, getUserId, 'delete'), (req, res, next) => {
      let current = false;
      let message = false;

      // turnd off eslint: should be allowed to change req.session
      req.session.deleteUserId = req.params.id; // eslint-disable-line no-param-reassign

      // Don't let users delete the currently logged in user
      if (parseInt(req.params.id, 10) === req.user.id) {
        current = true;
        message = config.users.messages.errors.current;
      }

      return database('users').where('id', req.params.id).then(rows => {
        if (rows.length < 1) {
          const error = {
            message: config.users.messages.errors.delete,
            status: 404,
            safe: '/users',
          };

          return next(error);
        }
        const user = rows[0];

        return res.render('users/delete', {
          title: config.users.actions.delete,
          email: user.email,
          action: `/${config.users.base}/${config.users.actions.delete}`,
          user: req.user,
          current,
          message,
        });
      })
      .catch(error => {
        return next(error);
      });
    });

    /*
     * @name Delete user POST method
     *
     * @param {object} req - HTTP Request
     * @param {object} res - HTTP Response
     * @param {object} next - Express callback
    */
    app.post(`/${config.users.base}/${config.users.actions.delete}`, [
      multipartMiddleware,
      acl.middleware(1, getUserId, 'delete'),
    ], (req, res, next) => {
      if (parseInt(req.session.deleteUserId, 10) === req.user.id) {
        // req.session.message = config.users.messages.errors.current;
        res.redirect(`/${config.users.base}`);
      }
      else {
        database('users').where('id', '=', req.session.deleteUserId).del().then(() => {
          // turnd off eslint: should be allowed to change req.session
          delete req.session.deleteUserId; // eslint-disable-line no-param-reassign
          res.redirect(`/${config.users.base}`);
        })
        .catch(error => {
          next(error);
        });
      }
    });

    app.use(acl.middleware.errorHandler('html'));

    resolve(app);
  });
};

module.exports = routes;
