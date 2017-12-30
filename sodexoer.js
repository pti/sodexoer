const needle = require('needle')
const fs = require('fs')

const weekdayNames = {
    monday: "Maanantai",
    tuesday: "Tiistai",
    wednesday: "Keskiviikko",
    thursday: "Torstai",
    friday: "Perjantai",
    saturday: "Lauantai",
    sunday: "Sunnuntai"
}

const lang = "fi"
const restaurantIds = ['134', '9870']
const template = fs.readFileSync('template.html', 'utf8')

writeTableContent()

// TODO lataa uudestaan automaattisesti kun päivä vaihtuu

async function writeTableContent() {
    const weekDatas = await getWeekDatas(restaurantIds)
    let out = ""

    for (const weekData of weekDatas) {

        const restaurant = {
            name: weekData.meta.ref_title,
            url: weekData.meta.ref_url
        }
    
        out += `<th class="restaurant_header"><a href=${restaurant.url}>${restaurant.name}</a></th>`
    }

    for (const weekday in weekdayNames) {
        
        if (weekDatas.map(wd => wd.menus[weekday]).filter(menu => menu !== undefined).length == 0) {
            continue
        }

        out += "<tr>"
        const weekdayName = weekdayNames[weekday]

        for (const weekData of weekDatas) {
            out += '<td class="day">'
            out += `<p class="weekday">${weekdayName}</p>`
    
            const menuItems = weekData.menus[weekday]

            if (menuItems !== undefined) {

                for (const item of menuItems) {
                    const title = item[`title_${lang}`]
                    const desc = item[`desc_${lang}`]
                    const price = item.price
        
                    out += `<p class="food"><span class="text">${title}</span>`
        
                    if (item.properties) {
                        const props = item.properties.split(/, */)
                        props.forEach(prop => out += `<span class="info">${prop}</span>`)
                    }
                    
                    out += '</p>'
                }    
            }
        
            out += '</td>'    
        }

        out += "</tr>"
    }

    const result = template.replace('<##>', out)
    fs.writeFileSync('output.html', result, 'utf8')    
}

function zeroPad(number) {
    return number < 10 ? "0" + number : number;
}

function datePart() {
    const date = new Date()
    return `${date.getFullYear()}/${zeroPad(date.getMonth() + 1)}/${zeroPad(date.getDate())}`
}

function weeklyUrl(restaurantId) {
    return `https://www.sodexo.fi/ruokalistat/output/weekly_json/${restaurantId}/${datePart()}/${lang}`
}

async function getWeekDatas(restaurantIds) {
    let result = []

    for (const restaurantId of restaurantIds) {
        let data = await get(weeklyUrl(restaurantId))

        if (data) {
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
