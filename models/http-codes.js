const HttpCodes = Object.freeze({
  OK: 200,
  Created: 201,
  BadRequest: 400,
  UnauthorizedClient: 401,
  NotFound: 404,
  UnprocessableEntity: 422,
  InternalServerError: 500,
});

module.exports = HttpCodes;
