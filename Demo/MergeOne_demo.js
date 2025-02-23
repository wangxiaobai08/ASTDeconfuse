function a(e, r) {
  for (var o = 5; void 0 !== o;) {
    var a,
      t,
      i = 15 & o >> 4;
    switch (o) {
      case 5:
        var v = "\xd3\xd0\xdc\xde\xcb\xd6\xd0\xd1",
          l = "",
          p = 0;
        o = 48;
        break;
      case 48:
        o = p < v.length ? 2 : 6
        break;
      case 64:
        o = d < h.length ? 1 : 32
        break;
      case 4:
        return e;
      case 2:
        var s = 191 ^ v.charCodeAt(p);
        l += String.fromCharCode(s), o = 0;
        break;
      case 6:
        var g,
          C = "l";
        C += "o", C += "coto";
        var f,
          u = "f",
          b = r[l][C = (C += "rp").split("").reverse().join("")] === (u += "ile:");
        o = b ? 7 : 8;
        break;
      case 1:
        var n = 588 ^ h.charCodeAt(d);
        c += String.fromCharCode(n), o = 16;
        break;
      case 32:
        e = c + e;
        o = 4;
        break;
      case 16:
        d++;
        o = 64;
        break;
      case 0:
        p++;
        o = 48;
        break;
      case 7:
        var m = "^\\";
        m += "/\\", m += "/";
        var k,
          A = "t";
        A += "se", b = new RegExp(m)[A = (A += "t").split("").reverse().join("")](e), o = 8;
        break;
      case 8:
        var S;
        o = b ? 3 : 4;
        break;
      case 3:
        var h = "Ȥȸȸȼɶ",
          c = "",
          d = 0;
        o = 64;
        break;
    }
  }
}