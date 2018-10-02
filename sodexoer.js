const needle = require('needle')
const fs = require('fs')
const _ = require('lodash')
const antellizer = require('./antellizer.js')

const weekdayNames = {
    monday: "Maanantai",
    tuesday: "Tiistai",
    wednesday: "Keskiviikko",
    thursday: "Torstai",
    friday: "Perjantai",
    saturday: "Lauantai",
    sunday: "Sunnuntai"
}

const args = process.argv.slice(2)
const lang = "fi"

const restaurants = [
    {type: 'sodexo', id: 134, name: 'Hermia 5'},
    {type: 'sodexo', id: 9870, name: 'Hermia 6'},
    {type: 'antell', id: 342, name: 'Farmi'},
]

const template = fs.readFileSync('template.html', 'utf8')

writeTableContent()

async function writeTableContent() {
    const weekDatas = await getWeekDatas(restaurants)
    let out = ""
    out += "<tr>"

    for (const weekData of weekDatas) {

        const restaurant = {
            name: weekData.meta.ref_title,
            url: weekData.meta.ref_url
        }
    
        out += `<th class="restaurant_header"><a href="${restaurant.url}">${restaurant.name}</a></th>`
    }

    out += "</tr>"

    for (const weekday in weekdayNames) {
        
        if (weekDatas.map(wd => wd.menus[weekday]).filter(menu => menu !== undefined).length == 0) {
            continue
        }

        out += "<tr>"
        let weekdayName = weekdayNames[weekday]

        if (weekdayName === undefined) {
            weekdayName = weekday
        }

        for (const weekData of weekDatas) {
            out += '<td class="day">'
            out += `<p class="weekday">${weekdayName}</p>`
    
            const menuItems = weekData.menus[weekday]

            if (menuItems !== undefined) {

                for (const item of menuItems) {
                    out += menuItemAsHtml(item, lang)
                }    
            }

            out += '</td>'    
        }

        out += "</tr>"
    }

    const result = template.replace('<##>', out)
    const dst = _.defaultTo(_.head(args), 'output.html')
    fs.writeFileSync(dst, result, 'utf8')    
}

function menuItemAsHtml(item, lang) {
    let out = `<p class="food">`

    if (item.parts !== undefined) {

        for (let part of item.parts) {
            out += `<span class="text">${part.text}</span>`
            part.properties.forEach(prop => out += `<span class="info">${prop}</span>`)
        }

    } else {
        const title = item[`title_${lang}`]
        const desc = item[`desc_${lang}`]
        const price = item.price

        out += `<span class="text">${title}</span>`

        if (desc) {
            out += `<span class="desc">${desc}</span>`
        }

        if (item.properties) {
            const props = item.properties.split(/, */)
            props.forEach(prop => out += `<span class="info">${prop}</span>`)
        }
    }

    out += '</p>'
    return out
}

function zeroPad(number) {
    return number < 10 ? "0" + number : number;
}

function datePart() {
    const date = new Date()
    return `${date.getFullYear()}/${zeroPad(date.getMonth() + 1)}/${zeroPad(date.getDate())}`
}

function sodexoWeeklyUrl(restaurantId) {
    return `https://www.sodexo.fi/ruokalistat/output/weekly_json/${restaurantId}/${datePart()}/${lang}`
}

async function getWeekDatas(restaurantIds) {
    let result = []

    for (const restaurant of restaurants) {
        let data = undefined
        let url = undefined

        if (restaurant.type == 'sodexo') {
            url = sodexoWeeklyUrl(restaurant.id)
            data = await get(url)

        } else if (restaurant.type == 'antell') {
            url = `https://www.antell.fi/lounaslistat/lounaslista.html?owner=${restaurant.id}`
            data = await antellizer.loadMenu(url)
        }

        if (data) {
            // Use the predefined restaurant name and url if 'data' doesn't define it. Currently needed for the 'antell' case.
            data.meta = Object.assign({}, {ref_title: restaurant.name, ref_url: url}, data.meta)
            result.push(data)
        }
    }

    return result
}

async function get(url) {
    const resp = await needle('get', url, {}, {follow: 1})

    if (resp.statusCode < 400) {
        return resp.body
    } else {
        console.log(`status=${resp.statusCode}`)
        return null
    }
}
