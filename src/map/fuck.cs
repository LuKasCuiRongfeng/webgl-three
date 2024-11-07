using UnityEngine;

[RequireComponent(typeof(Camera))]
public class MapPan : MonoBehaviour
{
    public bool resetPositionOnEndDrag = true;// optional

    private Vector3 worldStartPosition;
    private Vector3 cameraStartPosition;
    private Camera panCam;
    private bool isdragging = false;

    private void Start()
    {
        panCam = GetComponent<Camera>();
    }

    private void Update()
    {
        RaycastHit hit;
        var screenPosition = Input.mousePosition;

        if(Input.GetMouseButtonDown(0))
        {
            var ray = panCam.ScreenPointToRay(screenPosition);

            isdragging = Physics.Raycast(ray,out hit,panCam.farClipPlane);
            if(isdragging)
            {
                cameraStartPosition = panCam.transform.position;
                worldStartPosition = ray.GetPoint(hit.distance);
            }
            return;
        }


        if(isdragging)
        {
            if(Input.GetMouseButton(0))
            {
                if(panCam)
                {
                    var ray = panCam.ScreenPointToRay(screenPosition);

                    if(!Physics.Raycast(ray,out hit,panCam.farClipPlane))
                    {
                        //current raycast not hitting anything then don't move camera
                        bool offscreen = screenPosition.x < 0 || screenPosition.y < 0 || screenPosition.x > panCam.pixelWidth || screenPosition.y > panCam.pixelHeight;

                        if(!offscreen) //but if not hitting anything and mouse is onscreen, then assume player dragged to the void and reset camera position
                            panCam.transform.position = cameraStartPosition;

                        return;
                    }

                    var worldDelta = worldStartPosition - ray.GetPoint(hit.distance);
                    panCam.transform.position += worldDelta;
                }
            }
            else
            {
                // reset and cleanup data from drag
                worldStartPosition = Vector3.zero;
                isdragging = false;

                if(resetPositionOnEndDrag)
                {
                    panCam.transform.position = cameraStartPosition;
                }
            }
        }
    }
}