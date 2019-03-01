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

    let menu = {}
    const doc = cheerio.load(html)

    doc('div .lunch-menu-language').first().find('h3').each(function (index, element) {
        let elem = doc(this)
        let wd = undefined

        if (elem.text() !== undefined) {
            wd = weekdayMap.get(elem.text().replace(/^(\w+).*/, '$1'))
        }

        if (wd === undefined) {
            return
        }

        let weekdayItems = []
        menu[wd] = weekdayItems

        elem.next('ul').find('li').each((i, elem) => {
            const li = doc(elem)

            if (li.attr('class') === 'menu-item-category') {
                const type = li.find('strong').first().text().trim()

            } else {
                let txt = li.text()
                    .trim()
                    .replace(/\s{2,}/g, ' ')
                    .replace(/ ,/, ',')

                // Each menu item can contain multiple pieces and each can have their own set of properties (L, G and such).
                // Split the item to pieces and create an object for each that defines the text part and the properties.
                // HTML generator can the apply proper styling for the separated properties.
                const pieces = txt.split(/\(((?:(?:Veg|[A-Z*])(?:, )?)+)\)/)
                let parts = []

                for (let i = 0; i < pieces.length; i += 2) {
                    let properties = []
                    let text = pieces[i]

                    if (text.length == 0) {
                        continue
                    }

                    if (i < pieces.length - 1) {
                        properties = pieces[i + 1].split(/, ?/)
                    }

                    parts.push({
                        text: text.trim().replace(/^, /, ''),
                        properties: properties
                    })
                }

                weekdayItems.push({parts: parts})
            }
        })
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
