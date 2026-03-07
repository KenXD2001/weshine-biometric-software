import $ from 'jquery'

const uri = "https://localhost:8030/morfinauth/"; //Secure
// const uri = "http://localhost:8030/morfinauth/"; //Non-Secure
//const uri = "http://rd.mxface.ai:8030/morfinauth/"; //Custom Cert

function GetMorFinAuthInfo(connectedDvc , clientKey) {
    const MorFinAuthRequest = {
        "ConnectedDvc": connectedDvc,
        "ClientKey": clientKey
    };
    const jsondata = JSON.stringify(MorFinAuthRequest);
    return PostMorFinAuthClient("info", jsondata);
}
function IsDeviceConnected(connectedDvc) {
     const MorFinAuthRequest = {
         "ConnectedDvc": connectedDvc
    };
    const jsondata = JSON.stringify(MorFinAuthRequest);
    return PostMorFinAuthClient("checkdevice", jsondata);
}
function InitDevice(connectedDvc ,clientKey) {
    const MorFinAuthRequest = {
        "ConnectedDvc": connectedDvc,
        "ClientKey": clientKey
    };
    const jsondata = JSON.stringify(MorFinAuthRequest);
    return PostMorFinAuthClient("initdevice", jsondata);
}
function UninitDevice() {
    return PostMorFinAuthClient("uninitdevice", "", 0);
}
function GetSupportedDeviceList() {
    return PostMorFinAuthClient("supporteddevicelist", "", 0);
}
function GetConnectedDeviceList() {
    return PostMorFinAuthClient("connecteddevicelist", "", 0);
}
function GetMorFinAuthKeyInfo(key) {
    const MorFinAuthRequest = {
        "Key": key,
    };
    const jsondata = JSON.stringify(MorFinAuthRequest);
    return PostMorFinAuthClient("keyinfo", jsondata);
}
function CaptureFinger(quality, timeout) {
    const MorFinAuthRequest = {
        "Quality": quality,
        "TimeOut": timeout
    };
    const jsondata = JSON.stringify(MorFinAuthRequest);
    return PostMorFinAuthClient("capture", jsondata);
}

function VerifyFinger(ProbFMR, GalleryFMR, tmpFormat) {
    const MorFinAuthRequest = {
        "ProbTemplate": ProbFMR,
        "GalleryTemplate": GalleryFMR,
        "TmpFormat": tmpFormat
    };
    const jsondata = JSON.stringify(MorFinAuthRequest);
    return PostMorFinAuthClient("verify", jsondata);
}
function MatchFinger(quality, timeout, GalleryFMR, tmpFormat) {
    const MorFinAuthRequest = {
        "Quality": quality,
        "TimeOut": timeout,
        "GalleryTemplate": GalleryFMR,
        "TmpFormat": tmpFormat
    };
    const jsondata = JSON.stringify(MorFinAuthRequest);
    return PostMorFinAuthClient("match", jsondata);
}
function GetImage(imgformat) {
    const MorFinAuthRequest = {
        "ImgFormat": imgformat
    };
    const jsondata = JSON.stringify(MorFinAuthRequest);
    return PostMorFinAuthClient("getimage", jsondata);
}
function GetTemplate(tmpFormat) {
    const MorFinAuthRequest = {
        "TmpFormat": tmpFormat
    };
    const jsondata = JSON.stringify(MorFinAuthRequest);
    return PostMorFinAuthClient("gettemplate", jsondata);
}
function PostMorFinAuthClient(method: string, jsonData: string, isBodyAvailable = 1) {
    let res;
    if (isBodyAvailable == 0) {
        $.support.cors = true;
        let httpStaus = false;
        $.ajax({
            type: "POST",
            async: false,
            crossDomain: true,
            url: uri + method,
            contentType: "application/json; charset=utf-8",
            dataType: "json",
            processData: false,
            success: function (data) {
                httpStaus = true;
                res = { httpStaus: httpStaus, data: data };
            },
            error: function (jqXHR, ajaxOptions, thrownError) {
                res = { httpStaus: httpStaus, err: getHttpError(jqXHR) };
            },
        });
    }
    else {
        $.support.cors = true;
        let httpStaus = false;
        $.ajax({
            type: "POST",
            async: false,
            crossDomain: true,
            url: uri + method,
            contentType: "application/json; charset=utf-8",
            data: jsonData,
            dataType: "json",
            processData: false,
            success: function (data) {
                httpStaus = true;
                res = { httpStaus: httpStaus, data: data };
            },
            error: function (jqXHR, ajaxOptions, thrownError) {
                res = { httpStaus: httpStaus, err: getHttpError(jqXHR) };
            },
        });
    }
    return res;
}
function GetMorFinAuthClient(method) {
    let res;
    $.support.cors = true;
    let httpStaus = false;
    $.ajax({
        type: "GET",
        async: false,
        crossDomain: true,
        url: uri + method,
        contentType: "application/json; charset=utf-8",
        processData: false,
        success: function (data) {
            httpStaus = true;
            res = { httpStaus: httpStaus, data: data };
        },
        error: function (jqXHR, ajaxOptions, thrownError) {
            res = { httpStaus: httpStaus, err: getHttpError(jqXHR) };
        },
    });
    return res;
}
function getHttpError(jqXHR) {
    let err = "Unhandled Exception";
    if (jqXHR.status === 0) {
        err = 'Service Unavailable';
    } else if (jqXHR.status == 404) {
        err = 'Requested page not found';
    } else if (jqXHR.status == 500) {
        err = 'Internal Server Error';
    } else {
        err = 'Unhandled Error';
    }
    return err;
}

export {
    CaptureFinger,
    GetMorFinAuthInfo,
    MatchFinger,
    IsDeviceConnected,
    GetConnectedDeviceList
}