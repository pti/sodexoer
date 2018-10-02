const needle = require('needle')
const cheerio = require('cheerio')

const weekdayMap = new Map([
    ["Maanantai", "monday"],
    ["Tiistai", "tuesday"],
    ["Keskiviikko", "wednesday"],
    ["Torstai", "thursday"],
    ["Perjantai", "friday"],
    ["Lauantai", "saturday"],
    ["Sunnuntai", "sunday"],
])

const ignoreRegExps = createIgnoreRegExps()

function createIgnoreRegExps() {
    const ignoreTexts = ['BBQ-GRILLI', 'PÄIVÄN LOUNAS', 'DELI', 'PÄIVÄN JÄLKIRUOKA']
    let regExps = []

    for (it of ignoreTexts) {
        regExps.push(new RegExp(`${it}(:\\s*)?`))
    }

    regExps.push(new RegExp('\\d+,\\d+'))
    return regExps
}

function removeIgnoreTexts(txt) {

    for (ire of ignoreRegExps) {
        txt = txt.replace(ire, '')
    }
    
    return txt
}

/**
 * Loads the HTML page containing the weekly menu and parses the information.
 * 
 * @param {string} url weekly menu web page URL.
 * @returns an object containing the menu information, structure has some similarities with the Sodexo JSON.
 */
async function loadMenu(url) {
    
    let html = await get(url)

    if (html == null) {
        return
    }

    const doc = cheerio.load(html)
    let table = doc('table#lunch-content-table')
    doc('.lunch-footer-table').remove()
    doc('.lunch-ad').remove()
 
    let inner = table.find('td.outer')
    inner.find('table').last().remove() // Removes the part with share options.
    inner.find('table').last().remove() // Removes the legend part.
    let menu = {}
    let weekdayItems = undefined
    const partPattern = new RegExp('', 'g')

    inner.find('td').each(function(i, elem) {
        let k = doc(this)

        if (k.has('td').length == 0) {
            let txt = k.text().trim()

            if (txt.length > 0) {
                txt = removeIgnoreTexts(txt)

                if (txt.length > 0) {
                    const wd = weekdayMap.get(txt)

                    if (wd !== undefined) {
                        weekdayItems = []
                        menu[wd] = weekdayItems

                    } else {
                        // Each menu item can contain multiple pieces and each can have their own set of properties (L, G and such).
                        // Split the item to pieces and create an object for each that defines the text part and the properties.
                        // HTML generator can the apply proper styling for the separated properties.
                        const pieces = txt.split(/\(([A-Z,*]+)\)/)
                        let parts = []

                        for (let i = 0; i < pieces.length; i += 2) {
                            let properties = []
                            let text = pieces[i]

                            if (text.length == 0) {
                                continue
                            }

                            if (i < pieces.length - 1) {
                                properties = pieces[i + 1].split(',')
                            }

                            parts.push({
                                text: text.trim(),
                                properties: properties
                            })
                        }

                        weekdayItems.push({parts: parts})
                    }
                }    
            }
        }
    })

    return {
        menus: menu
    }
}

async function get(url) {
    const resp = await needle('get', url)

    if (resp.statusCode < 400) {
        return resp.body
    } else {
        console.log(`status=${resp.statusCode}`)
        return null
    }
}

exports.loadMenu = loadMenu
