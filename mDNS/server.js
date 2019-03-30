const mdns = require('../node_modules/zwot-multicast-dns')()
const wtm = require('../wtm')

function Bonjour () {
  this.init = function () {
    const ip = require('ip')
    const config = wtm.getConfig({ configPath: '', rootPath: 'public/' })
    const listServicewithIns = []
    const listService = []
    const srv = new Map()
    const txt = new Map()
    config.A.data = ip.address()
    wtm.updateConfig({ configPath: '', rootPath: 'public/', config: config })
    for (let i = 0; i < Object.keys(config.WoTs).length; i++) {
      if (Object.keys(config.WoTs)[i] !== config.Instance) {
        let name = Object.keys(config.WoTs)[i]
        let service = config.WoTs[Object.keys(config.WoTs)[i]]
        let serviceSyntax = `${name}._sub`
        for (let j = 0; j < service.protocols.length; j++) {
          serviceSyntax += `._${service.protocols[j]}`
          if (j === service.protocols.length - 1) { serviceSyntax += '.local' }
        }
        listServicewithIns.push(`${config.Instance}.${serviceSyntax}`)
        srv.set(`${config.Instance}.${serviceSyntax}`, JSON.stringify(service.SRV))
        txt.set(`${config.Instance}.${serviceSyntax}`, JSON.stringify(service.TXT))
        listService.push(serviceSyntax)
      }
    }
    this.listServicewithIns = listServicewithIns
    this.listService = listService
    this.srv = srv
    this.txt = txt
    return { allService: listService, allServiceIns: listServicewithIns, srv: srv, txt: txt, a: config.A }
  }
  this.listen = function () {
    let bonjour = this
    let config = wtm.getConfig({
      configPath: '',
      rootPath: 'public/'
    })
    mdns.on('query', function (res, info) {
      let listServicewithIns = bonjour.listServicewithIns
      let listService = bonjour.listService
      let srv = bonjour.srv
      let txt = bonjour.txt
      let promise = new Promise(function (resolve, reject) {
        const answers = []
        const additionals = []
        const QU = res.questions.map(function (element) { return element.QU }).includes(true)
        if (res.questions.map((element) => { return element.type }).includes('PTR')) {
          if (res.questions.map(function (element) {
            if (element.type === 'PTR') { return element.name }
          }).includes('_services._dns-sd._udp.local')) {
            for (let i = 0; i < listService.length; i++) {
              let packet = {}
              packet.name = '_services._dns-sd._udp.local'
              packet.type = 'PTR'
              packet.ttl = 120
              packet.data = config.Instance + '.' + listService[i]
              answers.push(packet)
            }
          } else if (listService.includes(res.questions.map(function (element) {
            if (element.type === 'PTR') {
              return element.name
            }
          }).toString())) {
            let packet = {}
            packet.name = res.questions.map(function (element) {
              if (element.type === 'PTR') {
                return element.name
              }
            }).toString()
            packet.type = 'PTR'
            packet.ttl = 120
            packet.data = config.Instance + '.' + packet.name
            answers.push(packet)
          }
        }
        if (res.questions.map((element) => {
          return element.type
        }).includes('SRV')) {
          console.log(res.questions.map(function (element) {
            if (element.type === 'SRV') {
              return element.name
            }
          }))
          if (listServicewithIns.includes(res.questions.map(function (element) {
            if (element.type === 'SRV') {
              return element.name
            }
          }).toString())) {
            let packet = {}
            let serviceSRV = JSON.parse(srv.get(res.questions.map(function (element) {
              if (element.type === 'SRV') {
                return element.name
              }
            }).toString()))
            packet.name = res.questions.map(function (element) {
              if (element.type === 'SRV') {
                return element.name
              }
            }).toString()
            packet.type = 'SRV'
            packet.ttl = 120
            packet.data = serviceSRV
            answers.push(packet)
          }
        }
        if (res.questions.map((element) => {
          return element.type
        }).includes('TXT')) {
          if (listServicewithIns.includes(res.questions.map(function (element) {
            if (element.type === 'TXT') {
              return element.name
            }
          }).toString())) {
            let packet = {}
            let serviceTXT = JSON.parse(txt.get(res.questions.map(function (element) {
              if (element.type === 'TXT') {
                return element.name
              }
            }).toString()))
            packet.name = res.questions.map(function (element) {
              if (element.type === 'TXT') {
                return element.name
              }
            }).toString()
            packet.type = 'TXT'
            packet.ttl = 120
            packet.data = []
            for (let i = 0; i < serviceTXT.length; i++) { packet.data.push(Buffer.from(serviceTXT[i], 'ascii')) }

            answers.push(packet)
          }
        }
        if (res.questions.map((element) => { return element.type }).includes('A')) {
          if (res.questions.map(function (element) {
            if (element.type === 'A') { return element.name }
          }).includes(config.A.name)) {
            let packet = {}
            packet.name = config.A.name
            packet.type = 'A'
            packet.ttl = 120
            packet.data = config.A.data
            packet.flush = true
            answers.push(packet)
          }
        }
        // console.log(info)
        resolve({ answers: answers, additionals: additionals, info: info, QU: QU })
      })
      promise.then(function (full) {
        if (full.QU) {
          console.log({ answers: full.answers, additionals: full.additionals })
          mdns.respond({ answers: full.answers, additionals: full.additionals }, full.info)
        } else {
          mdns.respond({ answers: full.answers, additionals: full.additionals })
        }
      })
    })
  }
}
module.exports = new Bonjour()
