let init = Date.now()
for (let i = 1; i <= 10000000000; i++) {
    //console.log(i)
}
let time_now = Date.now()
let minutes_taken_till_now = (time_now - init) / 60000;
console.log(minutes_taken_till_now)
// if (minutes_taken_till_now > ALLOWED_TIME_IN_MINUTES) {
//     break;
// }