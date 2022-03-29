function array_pivot_change(arr) {
    let pivot = Math.floor(Math.random() * (arr.length - 2));
    if(pivot === 0) {
        pivot += 1;
    }
    let first = arr.slice(0, pivot);
    let second = arr.slice(pivot, arr.length);

    let ans = second.concat(first)

    return ans

}

let auba = [1, 2, 3, 5, 6, 5, 4, 3, 2, 1, 3, 9]
let b = array_pivot_change(auba)

console.log(b)

let a = 1