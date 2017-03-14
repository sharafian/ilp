'use strict'

const cryptoHelper = require('./crypto')
const DATA_DELIMITER = '\n\n'

function _createRequest ({
  method,
  headers,
  data
}) {
  const statusLine = 'PSK/1.0 ' + method.toUpperCase() + '\n'
  const headerLines = Object.keys(headers)
    .map((k) => k + ': ' + headers[k])
    .join('\n') + DATA_DELIMITER

  let rawData = data
  if (!Buffer.isBuffer(data) && typeof data === 'object') {
    rawData = Buffer.from(JSON.stringify(data), 'utf8')
  } else if (data === undefined) {
    rawData = Buffer.from([])
  }

  return Buffer.concat([
    Buffer.from(statusLine, 'utf8'),
    Buffer.from(headerLines, 'utf8'),
    rawData
  ])
}

function createDetails ({
  unsafeHeaders,
  headers,
  secret,
  data
}) {
  const privateRequest = _createRequest({
    method: 'private',
    headers,
    data
  })

  const encrypted = cryptoHelper.aesEncryptBuffer(privateRequest, secret)
  const publicRequest = _createRequest({
    method: 'public',
    headers: unsafeHeaders,
    data: encrypted
  })

  return publicRequest
}

function _parseRequest (request) {
  const dataIndex = request.indexOf(Buffer.from(DATA_DELIMITER, 'utf8'))
  const head = request.slice(0, dataIndex).toString('utf8')
  const data = request.slice(dataIndex + DATA_DELIMITER.length)

  const [ statusLine, ...headerLines ] = head.split('\n')
  if (!head || !statusLine || !headerLines.length) {
    throw new Error('invalid request: "' + request.toString('utf8') + '"')
  }

  const [ , method ] = statusLine.match(/^PSK\/1\.0 (PUBLIC|PRIVATE)$/) || []
  if (!method) throw new Error('invalid status line: "' + statusLine + '"')

  const headers = headerLines.reduce((m, header) => {
    const [ , name, value ] = header.match(/(.+?): (.+)/) || []
    if (!name || !value) throw new Error('invalid header line: "' + header + '"')
    m[name] = value
    return m
  }, {})

  return {
    data,
    method,
    headers
  }
}

function parseDetails ({
  details,
  secret
}) {
  const detailsBuffer = Buffer.from(details, 'base64')
  const publicRequest = _parseRequest(detailsBuffer)
  const decrypted = cryptoHelper.aesDecryptBuffer(publicRequest.data, secret)
  const privateRequest = _parseRequest(decrypted)

  return {
    unsafeHeaders: publicRequest.headers,
    headers: privateRequest.headers,
    data: privateRequest.data
  }
}

module.exports = {
  _createRequest,
  _parseRequest,
  createDetails,
  parseDetails
}
